/** 小肥鱼养成状态：localStorage 持久化 + React 订阅。 */
import { useSyncExternalStore } from 'react'
import {
  feedPet, newPet, patPet, playPet, restPet, syncCompletedTasks, tickPet,
  type PetActionResult, type PetState,
} from '../pet-model.ts'

const PET_KEY = 'dsh-super-agent.pet.v1'
const listeners = new Set<() => void>()

function sanitize(value: unknown): PetState | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const num = (key: string, fallback: number): number => {
    const item = raw[key]
    return typeof item === 'number' && Number.isFinite(item) ? item : fallback
  }
  const base = newPet(Date.now())
  return {
    name: typeof raw['name'] === 'string' && raw['name'].trim() !== '' ? raw['name'].slice(0, 20) : base.name,
    xp: Math.max(0, num('xp', base.xp)),
    satiety: Math.max(0, Math.min(100, num('satiety', base.satiety))),
    mood: Math.max(0, Math.min(100, num('mood', base.mood))),
    energy: Math.max(0, Math.min(100, num('energy', base.energy))),
    lastTick: num('lastTick', base.lastTick),
    lastTaskCount: Math.max(0, num('lastTaskCount', 0)),
    lastFedAt: num('lastFedAt', 0),
    lastPlayedAt: num('lastPlayedAt', 0),
    lastPettedAt: num('lastPettedAt', 0),
    lastRestedAt: num('lastRestedAt', 0),
  }
}

function readStored(): PetState {
  try {
    const raw = window.localStorage.getItem(PET_KEY)
    if (raw === null) return newPet()
    return sanitize(JSON.parse(raw)) ?? newPet()
  } catch { return newPet() }
}

let current: PetState = readStored()

function persist(next: PetState): void {
  current = next
  try { window.localStorage.setItem(PET_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

export function usePet(): PetState {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => current,
  )
}

/** 结算离线时间；由宠物页挂载时和定时器调用。 */
export function tickPetNow(now: number = Date.now()): void {
  const next = tickPet(current, now)
  if (next !== current) persist(next)
}

export function feed(): PetActionResult {
  const result = feedPet(current, Date.now())
  if (result.ok) persist(result.pet)
  return result
}

export function play(): PetActionResult {
  const result = playPet(current, Date.now())
  if (result.ok) persist(result.pet)
  return result
}

export function pat(): PetActionResult {
  const result = patPet(current, Date.now())
  if (result.ok) persist(result.pet)
  return result
}

export function rest(): PetActionResult {
  const result = restPet(current, Date.now())
  if (result.ok) persist(result.pet)
  return result
}

export function syncTasks(completed: number): void {
  const next = syncCompletedTasks(current, completed)
  if (next !== current) persist(next)
}

/** 重置为一只新鱼（设置页/调试用）。 */
export function resetPet(): void {
  persist(newPet())
}
