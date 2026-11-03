/** Built-in expert roles hidden/deleted by the user (restorable). */
import { useSyncExternalStore } from 'react'

const KEY = 'dsh-super-agent.hiddenAgencyRoles'
const listeners = new Set<() => void>()
function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return []
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}
let current = read()
function persist(): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* private */ }
  for (const listener of listeners) listener()
}
export function hideAgencyRole(id: string): void {
  if (current.includes(id)) return
  current = [...current, id]
  persist()
}
export function showAgencyRole(id: string): void {
  const next = current.filter(item => item !== id)
  if (next.length === current.length) return
  current = next
  persist()
}
export function useHiddenAgencyRoles(): readonly string[] {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => current,
  )
}
