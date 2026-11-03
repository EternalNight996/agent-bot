/** Local custom character skins: a display name bound to an existing duty. */
import { useSyncExternalStore } from 'react'

export interface CustomRole {
  readonly id: string
  readonly name: string
  readonly role: string
  /** Skin/portrait id; when omitted the base role portrait is used. */
  readonly skin?: string
}

const CUSTOM_ROLES_KEY = 'dsh-super-agent.customRoles'
const listeners = new Set<() => void>()

function normalize(value: unknown): CustomRole[] {
  if (!Array.isArray(value)) return []
  const out: CustomRole[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const role = typeof raw.role === 'string' ? raw.role.trim() : ''
    if (name === '' || role === '') continue
    const id = typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id : name + ':' + role
    if (out.some(entry => entry.id === id || (entry.name === name && entry.role === role))) continue
    const skin = typeof raw.skin === 'string' && raw.skin.trim() !== '' ? raw.skin.trim() : undefined
    out.push({ id, name, role, ...(skin === undefined ? {} : { skin }) })
  }
  return out.slice(0, 40)
}

function readStored(): CustomRole[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_ROLES_KEY)
    return raw === null ? [] : normalize(JSON.parse(raw))
  } catch { return [] }
}

let current: CustomRole[] = readStored()

function persist(): void {
  try { window.localStorage.setItem(CUSTOM_ROLES_KEY, JSON.stringify(current)) } catch { /* private mode */ }
}

export function customRoles(): readonly CustomRole[] { return current }

export function addCustomRole(name: string, role: string, skin?: string): CustomRole | undefined {
  const cleanName = name.trim()
  const cleanRole = role.trim()
  if (cleanName === '' || cleanRole === '') return undefined
  const existing = current.find(entry => entry.name === cleanName && entry.role === cleanRole)
  if (existing !== undefined) return existing
  const id = 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
  const cleanSkin = skin?.trim() ?? ''
  const entry: CustomRole = { id, name: cleanName, role: cleanRole, ...(cleanSkin === '' ? {} : { skin: cleanSkin }) }
  current = [...current, entry]
  persist()
  for (const listener of listeners) listener()
  return entry
}

export function removeCustomRole(id: string): void {
  const next = current.filter(entry => entry.id !== id)
  if (next.length === current.length) return
  current = next
  persist()
  for (const listener of listeners) listener()
}

export function useCustomRoles(): readonly CustomRole[] {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => [],
  )
}
