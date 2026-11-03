/** Locally hidden built-in skins (restorable). */
import { useSyncExternalStore } from 'react'

const KEY = 'dsh-super-agent.hiddenSkins'
const listeners = new Set<() => void>()

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return []
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch { return [] }
}

let current: string[] = read()
function persist(): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

export function hideSkin(id: string): void {
  if (current.includes(id)) return
  current = [...current, id]
  persist()
}

export function showSkin(id: string): void {
  const next = current.filter(entry => entry !== id)
  if (next.length === current.length) return
  current = next
  persist()
}

export function useHiddenSkins(): readonly string[] {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => current,
  )
}
