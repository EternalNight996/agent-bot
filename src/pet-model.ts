/**
 * 养成宠物（小肥鱼）的纯逻辑：等级/经验、饱食/心情/精力、离线衰减与互动。
 *
 * 这里不碰 localStorage 和 React，便于单元测试；客户端 store 只负责持久化。
 */
export type PetStage = 'fry' | 'small' | 'fat' | 'whale'

export interface PetState {
  name: string
  xp: number
  satiety: number
  mood: number
  energy: number
  /** 上次结算时间（ms）。 */
  lastTick: number
  /** 上次已同步的任务完成数，避免重复发经验。 */
  lastTaskCount: number
  lastFedAt: number
  lastPlayedAt: number
  lastPettedAt: number
  lastRestedAt: number
}

export interface PetActionResult {
  readonly pet: PetState
  readonly ok: boolean
  /** 失败原因；ok=true 时为空。 */
  readonly reason?: 'full' | 'tired' | 'cooldown' | 'maxLevel'
}

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000
/** 离线最多结算 12 小时，避免久未打开后数值归零。 */
export const OFFLINE_CAP_MS = 12 * HOUR
export const MAX_LEVEL = 50

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)))

/** 升到下一级需要的经验（当前等级）。 */
export function xpForNextLevel(level: number): number {
  return 30 + Math.max(0, level - 1) * 20
}

/** 由累计经验反推等级与当前级进度。 */
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1
  let remaining = Math.max(0, Math.round(xp))
  while (level < MAX_LEVEL) {
    const need = xpForNextLevel(level)
    if (remaining < need) return { level, into: remaining, need }
    remaining -= need
    level += 1
  }
  return { level: MAX_LEVEL, into: 0, need: xpForNextLevel(MAX_LEVEL) }
}

export function stageOf(level: number): PetStage {
  if (level >= 8) return 'whale'
  if (level >= 5) return 'fat'
  if (level >= 3) return 'small'
  return 'fry'
}

export function newPet(now: number = Date.now()): PetState {
  return {
    name: '小肥鱼',
    xp: 0,
    satiety: 70,
    mood: 80,
    energy: 90,
    lastTick: now,
    lastTaskCount: 0,
    lastFedAt: 0,
    lastPlayedAt: 0,
    lastPettedAt: 0,
    lastRestedAt: 0,
  }
}

/**
 * 结算一段时间：饱食度下降、心情随饥饿加速下降、精力缓慢恢复。
 * 只按整分钟结算，离线时间截断到 12 小时。
 */
export function tickPet(pet: PetState, now: number = Date.now()): PetState {
  const elapsed = Math.max(0, Math.min(OFFLINE_CAP_MS, now - pet.lastTick))
  const minutes = Math.floor(elapsed / MINUTE)
  if (minutes <= 0) return pet
  const satiety = clamp(pet.satiety - Math.floor(minutes / 8))
  const moodDrop = satiety <= 0 ? Math.floor(minutes / 8) : Math.floor(minutes / 15)
  return {
    ...pet,
    satiety,
    mood: clamp(pet.mood - moodDrop),
    energy: clamp(pet.energy + Math.floor(minutes / 10)),
    lastTick: pet.lastTick + minutes * MINUTE,
  }
}

function cooled(pet: PetState, field: keyof PetState, now: number, cooldownMs: number): boolean {
  return now - (pet[field] as number) >= cooldownMs
}

export function feedPet(pet: PetState, now: number = Date.now()): PetActionResult {
  if (pet.satiety >= 100) return { pet, ok: false, reason: 'full' }
  if (!cooled(pet, 'lastFedAt', now, 15_000)) return { pet, ok: false, reason: 'cooldown' }
  return {
    ok: true,
    pet: {
      ...pet,
      satiety: clamp(pet.satiety + 26),
      mood: clamp(pet.mood + 5),
      energy: clamp(pet.energy - 2),
      xp: pet.xp + 6,
      lastFedAt: now,
    },
  }
}

export function playPet(pet: PetState, now: number = Date.now()): PetActionResult {
  if (pet.energy < 10) return { pet, ok: false, reason: 'tired' }
  if (!cooled(pet, 'lastPlayedAt', now, 20_000)) return { pet, ok: false, reason: 'cooldown' }
  return {
    ok: true,
    pet: {
      ...pet,
      mood: clamp(pet.mood + 18),
      energy: clamp(pet.energy - 12),
      satiety: clamp(pet.satiety - 4),
      xp: pet.xp + 8,
      lastPlayedAt: now,
    },
  }
}

export function patPet(pet: PetState, now: number = Date.now()): PetActionResult {
  if (!cooled(pet, 'lastPettedAt', now, 8_000)) return { pet, ok: false, reason: 'cooldown' }
  return {
    ok: true,
    pet: { ...pet, mood: clamp(pet.mood + 7), xp: pet.xp + 2, lastPettedAt: now },
  }
}

export function restPet(pet: PetState, now: number = Date.now()): PetActionResult {
  if (pet.energy >= 100) return { pet, ok: false, reason: 'full' }
  if (!cooled(pet, 'lastRestedAt', now, 30_000)) return { pet, ok: false, reason: 'cooldown' }
  return {
    ok: true,
    pet: {
      ...pet,
      energy: clamp(pet.energy + 24),
      mood: clamp(pet.mood + 2),
      xp: pet.xp + 3,
      lastRestedAt: now,
    },
  }
}

/** 每完成一个团队任务发一次经验，只对增量结算。 */
export function syncCompletedTasks(pet: PetState, completed: number): PetState {
  const delta = Math.max(0, Math.floor(completed) - pet.lastTaskCount)
  if (delta <= 0) return pet
  return {
    ...pet,
    xp: pet.xp + delta * 12,
    mood: clamp(pet.mood + delta * 4),
    lastTaskCount: Math.max(pet.lastTaskCount, Math.floor(completed)),
  }
}

/** 根据当前状态挑一句台词。 */
export function petSpeech(pet: PetState): 'hungry' | 'bored' | 'sleepy' | 'happy' {
  if (pet.satiety < 30) return 'hungry'
  if (pet.mood < 40) return 'bored'
  if (pet.energy < 25) return 'sleepy'
  return 'happy'
}
