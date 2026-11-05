/** Global captain skin preference (defaults to the project lead portrait). */
import { useSyncExternalStore } from 'react'
import { CAPTAIN_SKIN_ARTS, DEFAULT_CAPTAIN_SKIN, type CaptainSkinId } from './artwork.ts'

const CAPTAIN_SKIN_KEY = 'dsh-super-agent.captainSkin'
const listeners = new Set<() => void>()

function isSkinId(value: unknown): value is CaptainSkinId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CAPTAIN_SKIN_ARTS, value)
}

function readStored(): CaptainSkinId {
  try {
    const raw = window.localStorage.getItem(CAPTAIN_SKIN_KEY)
    return isSkinId(raw) ? raw : DEFAULT_CAPTAIN_SKIN
  } catch { return DEFAULT_CAPTAIN_SKIN }
}

let current: CaptainSkinId = readStored()

export const CAPTAIN_SKIN_OPTIONS = (Object.entries(CAPTAIN_SKIN_ARTS) as Array<[CaptainSkinId, { readonly name: string; readonly art: string }]>)
  .map(([id, value]) => ({ id, name: value.name, art: value.art }))

export function setCaptainSkin(id: CaptainSkinId): void {
  if (id === current) return
  current = id
  try { window.localStorage.setItem(CAPTAIN_SKIN_KEY, id) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

export function useCaptainSkin(): { readonly id: CaptainSkinId; readonly name: string; readonly art: string } {
  const id = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => DEFAULT_CAPTAIN_SKIN,
  )
  return { id, ...CAPTAIN_SKIN_ARTS[id] }
}
