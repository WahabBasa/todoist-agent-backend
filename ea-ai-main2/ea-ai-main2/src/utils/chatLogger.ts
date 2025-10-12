type ChatLogPayload = Record<string, unknown>;

interface LogOptions {
  dedupe?: boolean;
}

class ScopedChatLogger {
  private lastSessionId: string | null = null;
  private counters = new Map<string, number>();
  private lastSignature = new Map<string, string>();

  log(rawSessionId: string | null | undefined, event: string, payload: ChatLogPayload = {}, options: LogOptions = {}) {
    const sessionId = rawSessionId && rawSessionId.length > 0 ? rawSessionId : "default";
    const counter = (this.counters.get(sessionId) ?? 0) + 1;
    this.counters.set(sessionId, counter);

    const signatureEnabled = options.dedupe !== false;
    if (signatureEnabled) {
      const signature = this.buildSignature(event, payload);
      const last = this.lastSignature.get(sessionId);
      if (last === signature) {
        return;
      }
      this.lastSignature.set(sessionId, signature);
    }

    if (this.lastSessionId !== sessionId) {
      this.lastSessionId = sessionId;
      try {
        console.log(`\n[CHAT][${sessionId}] —— session focus ——`);
      } catch {}
    }

    try {
      console.debug(`[CHAT][${sessionId} #${String(counter).padStart(3, "0")}] ${event}`, payload);
    } catch {}
  }

  reset(rawSessionId: string | null | undefined) {
    const sessionId = rawSessionId && rawSessionId.length > 0 ? rawSessionId : "default";
    this.counters.delete(sessionId);
    this.lastSignature.delete(sessionId);
  }

  private buildSignature(event: string, payload: ChatLogPayload) {
    if (!payload || Object.keys(payload).length === 0) {
      return event;
    }
    try {
      return `${event}:${stableStringify(payload)}`;
    } catch {
      return event;
    }
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const normalized: Record<string, unknown> = {};
  for (const [key, val] of entries) {
    normalized[key] = normalize(val);
  }
  return normalized;
}

const isDev = typeof import.meta !== "undefined" ? Boolean((import.meta as any)?.env?.DEV) : false;
const logger = isDev ? new ScopedChatLogger() : null;

export function logChatEvent(sessionId: string | null | undefined, event: string, payload: ChatLogPayload = {}, options?: LogOptions) {
  if (!logger) return;
  logger.log(sessionId, event, payload, options);
}

export function resetChatLog(sessionId: string | null | undefined) {
  if (!logger) return;
  logger.reset(sessionId);
}
