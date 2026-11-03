/** Locally imported agency roles (metadata + prompt). */
import { useSyncExternalStore } from 'react'

export interface CustomAgencyRole {
  readonly id: string
  readonly name: string
  readonly category: 'product' | 'design' | 'engineering' | 'testing' | 'delivery'
  readonly skills: readonly string[]
  readonly executor: string
  readonly agent: string
  readonly prompt: string
}

const KEY = 'dsh-super-agent.customAgencyRoles'
const listeners = new Set<() => void>()
function read(): CustomAgencyRole[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return []
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value.flatMap((item): CustomAgencyRole[] => {
      if (item === null || typeof item !== 'object') return []
      const r = item as Record<string, unknown>
      const id = typeof r.id === 'string' ? r.id : ''
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      if (id === '' || name === '') return []
      const category = r.category === 'product' || r.category === 'design' || r.category === 'engineering' || r.category === 'testing' || r.category === 'delivery' ? r.category : 'engineering'
      return [{
        id, name, category,
        skills: Array.isArray(r.skills) ? r.skills.filter((s): s is string => typeof s === 'string') : [],
        executor: typeof r.executor === 'string' ? r.executor : 'implementer',
        agent: typeof r.agent === 'string' ? r.agent : 'dsh',
        prompt: typeof r.prompt === 'string' ? r.prompt : '',
      }]
    })
  } catch { return [] }
}
let current = read()
function persist(): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* private */ }
  for (const listener of listeners) listener()
}
export function addCustomAgencyRole(input: Omit<CustomAgencyRole, 'id'>): CustomAgencyRole | undefined {
  const name = input.name.trim()
  if (name === '') return undefined
  const id = 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
  const role: CustomAgencyRole = { ...input, id, name }
  current = [...current, role]
  persist()
  return role
}
export function removeCustomAgencyRole(id: string): void {
  const next = current.filter(role => role.id !== id)
  if (next.length === current.length) return
  current = next
  persist()
}
export function useCustomAgencyRoles(): readonly CustomAgencyRole[] {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => current,
  )
}
