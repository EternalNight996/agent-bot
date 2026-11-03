/** Hall member selection shared across remounts (the right column rebinds per session). */
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let current: string | undefined

export function setHallMember(name: string | undefined): void {
  if (current === name) return
  current = name
  for (const listener of listeners) listener()
}

export function hallMember(): string | undefined {
  return current
}

export function useHallMember(): string | undefined {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => current,
  )
}
