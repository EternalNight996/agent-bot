/** Per-role skill overrides, persisted locally; catalog skills are the default. */
import { useSyncExternalStore } from 'react'

const KEY = 'dsh-super-agent.roleSkills.v1'
const listeners = new Set<() => void>()

function read(): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return {}
    const value = JSON.parse(raw) as unknown
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
    const out: Record<string, string[]> = {}
    for (const [role, skills] of Object.entries(value as Record<string, unknown>)) {
      if (!Array.isArray(skills)) continue
      out[role] = skills.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    }
    return out
  } catch { return {} }
}

let current = read()

function publish(next: Record<string, string[]>): void {
  current = next
  try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

/** Explicit override for a role, or undefined when the catalog default applies. */
export function roleSkills(role: string): readonly string[] | undefined {
  return current[role]
}

/** Replace a role's selected skills; an empty list clears the override. */
export function setRoleSkills(role: string, skills: readonly string[]): void {
  const cleaned = [...new Set(skills.map(skill => skill.trim()).filter(skill => skill !== ''))]
  const next = { ...current }
  if (cleaned.length === 0) delete next[role]
  else next[role] = cleaned
  publish(next)
}

export function useRoleSkills(): Readonly<Record<string, readonly string[]>> {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => current,
  )
}
