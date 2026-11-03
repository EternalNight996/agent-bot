/** User-created skins: pixel identity + background + theme name. */
import { useSyncExternalStore } from 'react'

export interface CustomSkin {
  readonly id: string
  readonly name: string
  readonly art: string
  readonly background: string
  readonly theme: string
}

const KEY = 'dsh-super-agent.customSkins'
const listeners = new Set<() => void>()

function read(): CustomSkin[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return []
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value.flatMap((item): CustomSkin[] => {
      if (item === null || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      const id = typeof record.id === 'string' ? record.id : ''
      const name = typeof record.name === 'string' ? record.name.trim() : ''
      if (id === '' || name === '') return []
      return [{
        id,
        name,
        art: typeof record.art === 'string' ? record.art : '',
        background: typeof record.background === 'string' ? record.background : '#2a2418',
        theme: typeof record.theme === 'string' ? record.theme : '',
      }]
    })
  } catch { return [] }
}

let current: CustomSkin[] = read()

function persist(): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

export function addCustomSkin(name: string, art: string, background: string, theme: string): CustomSkin | undefined {
  const clean = name.trim()
  if (clean === '') return undefined
  const skin: CustomSkin = { id: 'skin-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), name: clean, art, background: background.trim() === '' ? '#2a2418' : background.trim(), theme: theme.trim() }
  current = [...current, skin]
  persist()
  return skin
}

export function removeCustomSkin(id: string): void {
  const next = current.filter(skin => skin.id !== id)
  if (next.length === current.length) return
  current = next
  persist()
}

export function useCustomSkins(): readonly CustomSkin[] {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => current,
  )
}
