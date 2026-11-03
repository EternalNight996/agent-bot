/** Per-role prompt overrides (editable in the role settings page). */
import { useSyncExternalStore } from 'react'

const KEY = 'dsh-super-agent.rolePrompts'
const listeners = new Set<() => void>()

function read(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return {}
    const value = JSON.parse(raw) as unknown
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
    const out: Record<string, string> = {}
    for (const [role, text] of Object.entries(value as Record<string, unknown>)) {
      if (typeof text === 'string' && text.trim() !== '') out[role] = text
    }
    return out
  } catch { return {} }
}

let current: Record<string, string> = read()
function persist(): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

export function rolePrompts(): Readonly<Record<string, string>> { return current }

export function setRolePrompt(role: string, text: string): void {
  const copy = { ...current }
  if (text.trim() === '') delete copy[role]
  else copy[role] = text
  current = copy
  persist()
}

export function useRolePrompts(): Readonly<Record<string, string>> {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => current,
  )
}
