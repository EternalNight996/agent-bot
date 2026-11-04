/** Lineups: themed groups that bind a prompt role to a pixel skin. */
import { useSyncExternalStore } from 'react'
import { PRIMARY_MODES, getModeSpec } from '../modes.ts'
import { modeLineup, modeLineupId } from './mode-lineups.ts'
import { SKINS } from './skins.ts'

export interface LineupEntry {
  readonly role: string
  readonly skin: string
}

export interface LineupDefinition {
  readonly id: string
  readonly name: string
  readonly theme: string
  readonly entries: readonly LineupEntry[]
  readonly builtin: boolean
}

const CUSTOM_LINEUPS_KEY = 'dsh-super-agent.customLineups'
const LINEUP_OVERRIDES_KEY = 'dsh-super-agent.lineupOverrides.v2'
const listeners = new Set<() => void>()

/**
 * 任务型阵容：按「接下来要干什么」组队，不再按阵营皮肤复制同一套 5 人名单。
 *
 * 旧版把 8 个洪荒阵营各自映射成同一条 5 人阵容（产品/高级开发/测试/审查/UI），
 * 实质只有一套有效组合，其余都是换皮；这里改为互不重复、职责完整的任务模板，
 * 席位上限仍是 5，空闲角色不消耗 token。
 */
const TASK_LINEUPS: ReadonlyArray<{
  readonly id: string
  readonly name: string
  readonly theme: string
  readonly roles: readonly string[]
}> = [
  {
    id: 'lineup-feature',
    name: '功能直交',
    theme: '主流程跑通 · 关键交互可点',
    roles: ['product-manager', 'engineering-senior-developer', 'testing-evidence-collector', 'engineering-code-reviewer'],
  },
  {
    id: 'lineup-bugfix',
    name: '缺陷修复',
    theme: '先复现 · 再修复 · 最后回归',
    roles: ['engineering-codebase-onboarding-engineer', 'engineering-senior-developer', 'testing-evidence-collector'],
  },
  {
    id: 'lineup-fullstack',
    name: '全栈功能',
    theme: '前端 + 后端 + 联调 + 验收',
    roles: ['product-manager', 'engineering-frontend-developer', 'engineering-backend-architect', 'testing-evidence-collector', 'engineering-code-reviewer'],
  },
  {
    id: 'lineup-audit',
    name: '只读审计',
    theme: '只取证、只给结论，不改代码',
    roles: ['engineering-codebase-onboarding-engineer', 'engineering-code-reviewer', 'testing-evidence-collector', 'engineering-technical-writer'],
  },
  {
    id: 'lineup-perf',
    name: '性能压测',
    theme: '可重复压测 · 指标与瓶颈结论',
    roles: ['product-manager', 'engineering-senior-developer', 'testing-performance-benchmarker', 'engineering-devops-automator'],
  },
  {
    id: 'lineup-security',
    name: '安全合规',
    theme: '攻击面 / 依赖 / 密钥审计',
    roles: ['security-appsec-engineer', 'security-cloud-security-architect', 'engineering-devops-automator', 'testing-evidence-collector'],
  },
]

/** 真实落库的模式预设阵容：可编辑、可设为默认、可作为开队选择。 */
function modePresetLineups(): LineupDefinition[] {
  return PRIMARY_MODES.map(mode => {
    const spec = getModeSpec(mode)
    return {
      id: modeLineupId(mode),
      name: spec.name + '阵容',
      theme: spec.emoji + ' 模式预设',
      builtin: true,
      entries: modeLineup(mode).map(seat => ({ role: seat.role, skin: seat.skin })),
    }
  })
}

function baseLineups(): LineupDefinition[] {
  const taskLineups = TASK_LINEUPS.map(lineup => ({
    id: lineup.id,
    name: lineup.name,
    theme: lineup.theme,
    builtin: true,
    entries: lineup.roles.map((role, seat) => ({
      role,
      // 席位不超过 8，循环取皮肤即可保证同一阵容内不重复。
      skin: (SKINS[seat % SKINS.length] ?? SKINS[0]!).id,
    })),
  }))
  return [...taskLineups, ...modePresetLineups()]
}

function readCustom(): LineupDefinition[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_LINEUPS_KEY)
    if (raw === null) return []
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value.flatMap((item): LineupDefinition[] => {
      if (item === null || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      const id = typeof record.id === 'string' ? record.id : ''
      const name = typeof record.name === 'string' ? record.name.trim() : ''
      const theme = typeof record.theme === 'string' ? record.theme.trim() : ''
      if (id === '' || name === '') return []
      const entries = Array.isArray(record.entries) ? record.entries.flatMap((entry): LineupEntry[] => {
        if (entry === null || typeof entry !== 'object') return []
        const e = entry as Record<string, unknown>
        const role = typeof e.role === 'string' ? e.role : ''
        const skin = typeof e.skin === 'string' ? e.skin : ''
        return role === '' || skin === '' ? [] : [{ role, skin }]
      }) : []
      return [{ id, name, theme, entries, builtin: false }]
    })
  } catch { return [] }
}

function readOverrides(): Record<string, LineupEntry[]> {
  try {
    const raw = window.localStorage.getItem(LINEUP_OVERRIDES_KEY)
    if (raw === null) return {}
    const value = JSON.parse(raw) as unknown
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
    const out: Record<string, LineupEntry[]> = {}
    for (const [id, entries] of Object.entries(value as Record<string, unknown>)) {
      if (!Array.isArray(entries)) continue
      out[id] = entries.flatMap((entry): LineupEntry[] => {
        if (entry === null || typeof entry !== 'object') return []
        const e = entry as Record<string, unknown>
        const role = typeof e.role === 'string' ? e.role : ''
        const skin = typeof e.skin === 'string' ? e.skin : ''
        return role === '' || skin === '' ? [] : [{ role, skin }]
      })
    }
    return out
  } catch { return {} }
}

let custom: LineupDefinition[] = readCustom()
let overrides: Record<string, LineupEntry[]> = readOverrides()

function computeLineups(): LineupDefinition[] {
  return [...baseLineups().map(lineup => overrides[lineup.id] === undefined ? lineup : { ...lineup, entries: overrides[lineup.id]! }), ...custom]
}

// useSyncExternalStore requires a stable snapshot; rebuilding the array on every
// getSnapshot triggers React #185 (maximum update depth).
let cachedLineups: LineupDefinition[] = computeLineups()

function persist(): void {
  try {
    window.localStorage.setItem(CUSTOM_LINEUPS_KEY, JSON.stringify(custom))
    window.localStorage.setItem(LINEUP_OVERRIDES_KEY, JSON.stringify(overrides))
  } catch { /* private mode */ }
  cachedLineups = computeLineups()
  for (const listener of listeners) listener()
}

export function allLineups(): LineupDefinition[] {
  return cachedLineups
}

export function lineupById(id: string | undefined): LineupDefinition | undefined {
  return id === undefined ? undefined : allLineups().find(lineup => lineup.id === id)
}

export function createLineup(name: string, theme: string): LineupDefinition | undefined {
  const clean = name.trim()
  if (clean === '') return undefined
  const id = 'lineup-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
  const lineup: LineupDefinition = { id, name: clean, theme: theme.trim(), entries: [], builtin: false }
  custom = [...custom, lineup]
  persist()
  return lineup
}

export function deleteLineup(id: string): void {
  custom = custom.filter(lineup => lineup.id !== id)
  delete overrides[id]
  persist()
}

export function setLineupEntries(id: string, entries: readonly LineupEntry[]): void {
  const builtin = baseLineups().some(lineup => lineup.id === id)
  if (builtin) overrides = { ...overrides, [id]: entries.map(entry => ({ ...entry })) }
  else custom = custom.map(lineup => lineup.id === id ? { ...lineup, entries: entries.map(entry => ({ ...entry })) } : lineup)
  persist()
}

/** 阵容人数上限：初始化与手动增员都不超过 5 人。 */
export const MAX_LINEUP_ENTRIES = 5

export function addLineupEntry(id: string, entry: LineupEntry): void {
  const lineup = lineupById(id)
  if (lineup === undefined) return
  if (lineup.entries.length >= MAX_LINEUP_ENTRIES) return
  setLineupEntries(id, [...lineup.entries, entry])
}

export function removeLineupEntry(id: string, index: number): void {
  const lineup = lineupById(id)
  if (lineup === undefined) return
  setLineupEntries(id, lineup.entries.filter((_, i) => i !== index))
}

export function resetLineup(id: string): void {
  if (overrides[id] === undefined) return
  const next = { ...overrides }
  delete next[id]
  overrides = next
  persist()
}

export function useLineups(): readonly LineupDefinition[] {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => cachedLineups,
    () => cachedLineups,
  )
}
