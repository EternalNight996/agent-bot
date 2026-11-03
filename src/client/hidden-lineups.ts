/** Locally hidden built-in lineups (delete from the lineup picker without editing code). */
import { useSyncExternalStore } from 'react'

const HIDDEN_LINEUPS_KEY = 'dsh-super-agent.hiddenLineups'
const listeners = new Set<() => void>()

function normalize(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))]
}

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(HIDDEN_LINEUPS_KEY)
    return raw === null ? [] : normalize(JSON.parse(raw))
  } catch { return [] }
}

let current: string[] = readStored()

function persist(): void {
  try { window.localStorage.setItem(HIDDEN_LINEUPS_KEY, JSON.stringify(current)) } catch { /* private mode */ }
}

export function hiddenLineups(): readonly string[] { return current }

export function hideLineup(id: string): void {
  if (current.includes(id)) return
  current = [...current, id]
  persist()
  for (const listener of listeners) listener()
}

export function showLineup(id: string): void {
  const next = current.filter(entry => entry !== id)
  if (next.length === current.length) return
  current = next
  persist()
  for (const listener of listeners) listener()
}

export function useHiddenLineups(): readonly string[] {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => [],
  )
}
