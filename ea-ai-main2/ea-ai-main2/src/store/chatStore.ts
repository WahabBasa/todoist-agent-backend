import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UIMessage } from '@ai-sdk/ui-utils'
import { logChatEvent } from '../utils/chatLogger'

export type UiStatus = 'ready' | 'submitted' | 'streaming'
export type UiRole = 'user' | 'assistant'

export interface UiMsg {
  id: string
  role: UiRole
  content: string
  parts?: UIMessage['parts']
  createdAt?: Date
}

export interface ChatInstance {
  input: string
  messages: UiMsg[]
  status: UiStatus
}

export interface ChatStore {
  instances: Record<string, ChatInstance>
  setInput: (id: string, v: string) => void
  setStatus: (id: string, s: UiStatus) => void
  replaceFromDb: (id: string, msgs: UiMsg[]) => void
  appendUser: (id: string, text: string) => string
  ensureAssistantPlaceholder: (id: string) => string
  updateAssistant: (id: string, patch: Partial<Pick<UiMsg, 'content' | 'parts'>>) => void
  clear: (id: string) => void
  resetStatuses: () => void
}

function getDefaultInstance(): ChatInstance {
  return { input: '', messages: [], status: 'ready' }
}

function genId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now()}-${rnd}`
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      instances: {},
      setInput: (id, v) => {
        const instances = get().instances
        const inst = instances[id] ?? getDefaultInstance()
        set({ instances: { ...instances, [id]: { ...inst, input: v } } })
      },
      setStatus: (id, s) => {
        const instances = get().instances
        const inst = instances[id] ?? getDefaultInstance()
        if (inst.status === s) return
        set({ instances: { ...instances, [id]: { ...inst, status: s } } })
      },
      replaceFromDb: (id, msgs) => {
        const instances = get().instances
        const inst = instances[id] ?? getDefaultInstance()
        logChatEvent(id, 'store_replace_from_db', {
          prevCount: inst.messages.length,
          nextCount: msgs.length,
          prevLastRole: inst.messages[inst.messages.length - 1]?.role ?? null,
          nextLastRole: msgs[msgs.length - 1]?.role ?? null,
        })
        set({ instances: { ...instances, [id]: { ...inst, messages: msgs } } })
      },
      appendUser: (id, text) => {
        const instances = get().instances
        const inst = instances[id] ?? getDefaultInstance()
        const userId = genId('user')
        const next: ChatInstance = {
          ...inst,
          messages: [
            ...inst.messages,
            {
              id: userId,
              role: 'user',
              content: text,
              parts: text ? [{ type: 'text', text } as UIMessage['parts'][number]] : [],
              createdAt: new Date(),
            },
          ]
        }
        set({ instances: { ...instances, [id]: next } })
        return userId
      },
      ensureAssistantPlaceholder: (id) => {
        const instances = get().instances
        const inst = instances[id] ?? getDefaultInstance()
        const last = inst.messages[inst.messages.length - 1]
        if (last && last.role === 'assistant') return last.id
        const asstId = genId('assistant')
        const next: ChatInstance = {
          ...inst,
          messages: [
            ...inst.messages,
            {
              id: asstId,
              role: 'assistant',
              content: '',
              parts: [],
              createdAt: new Date(),
            },
          ]
        }
        set({ instances: { ...instances, [id]: next } })
        return asstId
      },
      updateAssistant: (id, patch) => {
        const instances = get().instances
        const inst = instances[id] ?? getDefaultInstance()
        if (inst.messages.length === 0) {
          // create placeholder then update
          const asstId = get().ensureAssistantPlaceholder(id)
          const current = get().instances[id] ?? getDefaultInstance()
          const updated = current.messages.map((m) =>
            m.id === asstId ? { ...m, ...patch, parts: patch.parts ?? m.parts } : m
          )
          set({ instances: { ...get().instances, [id]: { ...current, messages: updated } } })
          return
        }
        const idx = inst.messages.length - 1
        const last = inst.messages[idx]
        if (last.role !== 'assistant') {
          const asstId = get().ensureAssistantPlaceholder(id)
          const current = get().instances[id] ?? getDefaultInstance()
          const updated = current.messages.map((m) =>
            m.id === asstId ? { ...m, ...patch, parts: patch.parts ?? m.parts } : m
          )
          set({ instances: { ...get().instances, [id]: { ...current, messages: updated } } })
          return
        }
        const msgs = inst.messages.slice()
        msgs[idx] = {
          ...last,
          ...patch,
          parts: patch.parts ?? last.parts,
        }
        set({ instances: { ...instances, [id]: { ...inst, messages: msgs } } })
      },
      clear: (id) => {
        const instances = get().instances
        set({ instances: { ...instances, [id]: getDefaultInstance() } })
      },
      resetStatuses: () => {
        const instances = get().instances
        const next: Record<string, ChatInstance> = {}
        let mutated = false
        for (const key of Object.keys(instances)) {
          const inst = instances[key]
          if (inst.status !== 'ready') {
            mutated = true
            next[key] = { ...inst, status: 'ready' }
            logChatEvent(key, 'store_reset_status', { previousStatus: inst.status })
          } else {
            next[key] = inst
          }
        }
        if (mutated) {
          set({ instances: { ...instances, ...next } })
        }
      }
    }),
    { name: 'chat-store' }
  )
)

export type { UiMsg as Message }
