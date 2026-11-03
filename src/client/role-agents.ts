/** Per-role execution Agent preference (dsh by default). */
import { useSyncExternalStore } from 'react'

const ROLE_AGENTS_KEY = 'dsh-super-agent.roleAgents'
const listeners = new Set<() => void>()

function readStored(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(ROLE_AGENTS_KEY)
    if (raw === null) return {}
    const value = JSON.parse(raw) as unknown
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
    const out: Record<string, string> = {}
    for (const [role, agent] of Object.entries(value as Record<string, unknown>)) {
      if (typeof agent === 'string' && agent.trim() !== '') out[role] = agent.trim()
    }
    return out
  } catch { return {} }
}

let current: Record<string, string> = readStored()

function persist(): void {
  try { window.localStorage.setItem(ROLE_AGENTS_KEY, JSON.stringify(current)) } catch { /* private mode */ }
}

export function roleAgents(): Readonly<Record<string, string>> { return current }

export function setRoleAgent(role: string, agent: string): void {
  const next = { ...current }
  if (agent.trim() === '') delete next[role]
  else next[role] = agent.trim()
  current = next
  persist()
  for (const listener of listeners) listener()
}

export function useRoleAgents(): Readonly<Record<string, string>> {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => ({}),
  )
}
