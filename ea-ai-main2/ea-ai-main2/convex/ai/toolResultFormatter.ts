import type { Value } from "convex/values"

const MAX_RAW_LENGTH = 4000

export type SummarySeverity = "success" | "info" | "error"

type ToolSummary = {
  summary: string | null
  severity: SummarySeverity
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function extractOutputShape(raw: unknown): {
  title?: string
  metadata?: Record<string, unknown>
  output?: unknown
  error?: string
} {
  const parsed = tryParseJson(raw)
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    const nestedOutput = tryParseJson(obj.output)
    return {
      title: typeof obj.title === "string" ? obj.title : undefined,
      metadata: typeof obj.metadata === "object" && obj.metadata !== null ? (obj.metadata as Record<string, unknown>) : undefined,
      output: nestedOutput ?? obj.output,
      error: typeof obj.error === "string" ? obj.error : undefined,
    }
  }

  return {
    output: parsed,
  }
}

function truncate(value: string, max = 300): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 3)}...`
}

function summariseCalendarResult(raw: unknown): ToolSummary {
  const shape = extractOutputShape(raw)
  const meta = shape.metadata ?? {}
  if (meta && typeof meta === "object" && "error" in meta && meta.error === "missing_range") {
    return {
      summary: "I need a start and end time to check your calendar. What time range should I use?",
      severity: "error",
    }
  }

  const output = shape.output
  if (Array.isArray(output)) {
    const count = output.length
    if (count === 0) {
      return {
        summary: "No upcoming events found in that window.",
        severity: "info",
      }
    }
    return {
      summary: `Retrieved ${count} calendar ${count === 1 ? "event" : "events"}.`,
      severity: "success",
    }
  }

  return {
    summary: null,
    severity: "info",
  }
}

function summariseWorkspaceMap(raw: unknown): ToolSummary {
  const shape = extractOutputShape(raw)
  const meta = shape.metadata ?? {}
  const projectCount = typeof meta.projectCount === "number" ? meta.projectCount : undefined
  const taskCount = typeof meta.taskCount === "number" ? meta.taskCount : undefined
  if (projectCount !== undefined || taskCount !== undefined) {
    const parts: string[] = []
    if (projectCount !== undefined) parts.push(`${projectCount} project${projectCount === 1 ? "" : "s"}`)
    if (taskCount !== undefined) parts.push(`${taskCount} task${taskCount === 1 ? "" : "s"}`)
    const summary = parts.join(", ")
    if (summary) {
      return {
        summary: `Workspace summary: ${summary}.`,
        severity: "success",
      }
    }
  }

  if (shape.title) {
    return {
      summary: shape.title,
      severity: "info",
    }
  }

  return {
    summary: null,
    severity: "info",
  }
}

function summariseTasks(raw: unknown): ToolSummary {
  const shape = extractOutputShape(raw)
  const meta = shape.metadata ?? {}

  const tasks = Array.isArray(meta?.tasks) ? (meta.tasks as any[]) : Array.isArray(shape.output) ? (shape.output as any[]) : []
  const total = typeof meta?.taskCount === "number" ? meta.taskCount : tasks.length

  if (!total && tasks.length === 0) {
    return {
      summary: "No open tasks found.",
      severity: "info",
    }
  }

  const now = new Date()
  const overdueTitles: string[] = []

  const overdueCount = tasks.reduce((count, task) => {
    const due = typeof task?.dueDate === "string" ? Date.parse(task.dueDate) : Number.NaN
    if (!Number.isNaN(due) && due < now.getTime()) {
      if (typeof task?.title === "string" && overdueTitles.length < 3) {
        overdueTitles.push(task.title)
      }
      return count + 1
    }
    return count
  }, 0)

  const parts: string[] = []
  if (total) {
    parts.push(`${total} open ${total === 1 ? "task" : "tasks"}`)
  }
  if (overdueCount) {
    parts.push(`${overdueCount} overdue`)
  }

  if (overdueTitles.length) {
    parts.push(`Overdue: ${overdueTitles.join(", ")}`)
  }

  return {
    summary: parts.length ? `Tasks summary: ${parts.join("; ")}.` : "Tasks retrieved.",
    severity: "success",
  }
}

function summariseGeneric(raw: unknown): ToolSummary {
  if (raw === null || raw === undefined) {
    return {
      summary: null,
      severity: "info",
    }
  }

  if (typeof raw === "object" && raw !== null) {
    const maybeError = (raw as Record<string, unknown>).error
    if (typeof maybeError === "string" && maybeError.trim()) {
      return {
        summary: `Tool error: ${maybeError.trim()}`,
        severity: "error",
      }
    }
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) {
      return {
        summary: null,
        severity: "info",
      }
    }
    if (trimmed.length > MAX_RAW_LENGTH) {
      return {
        summary: `${trimmed.slice(0, 297)}...`,
        severity: "info",
      }
    }
    return {
      summary: trimmed,
      severity: "info",
    }
  }

  if (typeof raw === "number" || typeof raw === "boolean") {
    return {
      summary: String(raw),
      severity: "info",
    }
  }

  return {
    summary: truncate(safeJsonStringify(raw)),
    severity: "info",
  }
}

export function describeToolResult(toolName: string | undefined, raw: unknown): ToolSummary {
  const name = (toolName ?? "").toLowerCase()

  switch (name) {
    case "listcalendarevents":
    case "googlecalendar.listcalendarevents":
      return summariseCalendarResult(raw)
    case "getprojectandtaskmap":
      return summariseWorkspaceMap(raw)
    case "gettasks":
    case "todoist.gettasks":
      return summariseTasks(raw)
    case "getcurrenttime":
      return {
        summary: "Fetched the current time.",
        severity: "info",
      }
    default:
      return summariseGeneric(raw)
  }
}

export function summariseToolResult(toolName: string | undefined, raw: unknown): string | null {
  return describeToolResult(toolName, raw).summary
}

export function formatToolResultForStorage(toolName: string | undefined, raw: unknown, extra?: {
  title?: unknown
  metadata?: unknown
}): { raw: Value; summary: string | null; status: SummarySeverity; title?: string; metadata?: Record<string, unknown> } {
  const description = describeToolResult(toolName, raw)

  let metadata: Record<string, unknown> | undefined
  if (extra && typeof extra.metadata === "object" && extra.metadata !== null) {
    metadata = extra.metadata as Record<string, unknown>
  }

  const title = typeof extra?.title === "string" ? extra.title : undefined

  return {
    raw: (raw ?? null) as Value,
    summary: description.summary,
    status: description.severity,
    ...(title ? { title } : {}),
    ...(metadata ? { metadata } : {}),
  }
}

export function summariseToolResults(results: Array<{ toolName?: string; output?: unknown; result?: unknown; metadata?: unknown; title?: unknown }>): string | null {
  const collected: { summary: string; severity: SummarySeverity; index: number }[] = []

  results.forEach((entry, index) => {
    const candidateRaw = entry.output ?? entry.result
    if (candidateRaw === undefined) return
    const { summary, severity } = describeToolResult(entry.toolName, candidateRaw)
    if (summary && summary.trim()) {
      collected.push({ summary: summary.trim(), severity, index })
    }
  })

  if (collected.length === 0) return null

  const errors = collected.filter((item) => item.severity === "error")
  if (errors.length) {
    return errors[errors.length - 1].summary
  }

  const successes = collected.filter((item) => item.severity === "success").map((item) => item.summary)
  const infos = collected.filter((item) => item.severity === "info").map((item) => item.summary)

  const uniqueOrdered = Array.from(new Set([...successes, ...infos].filter(Boolean)))
  if (uniqueOrdered.length === 0) return null

  return uniqueOrdered.join(" ")
}
