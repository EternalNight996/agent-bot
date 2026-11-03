/** Lineups: themed groups that bind a prompt role to a pixel skin. */
import { useSyncExternalStore } from 'react'
import { FACTIONS } from '../factions.ts'
import { agencyRoleForExecutor } from '../agency-roles-lite.ts'
import { PRIMARY_MODES, getModeSpec } from '../modes.ts'
import { modeLineup } from './mode-lineups.ts'
import { SKINS, skinIdForName } from './skins.ts'

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

/** 真实落库的模式预设阵容：可编辑、可设为默认、可作为开队选择。 */
function modePresetLineups(): LineupDefinition[] {
  return PRIMARY_MODES.map(mode => {
    const spec = getModeSpec(mode)
    return {
      id: 'mode-' + mode,
      name: spec.name + '阵容',
      theme: spec.emoji + ' 模式预设',
      builtin: true,
      entries: modeLineup(mode).map(seat => ({ role: seat.role, skin: seat.skin })),
    }
  })
}

function baseLineups(): LineupDefinition[] {
  const factions = FACTIONS.filter(faction => faction.id !== 'pilgrim').map(faction => ({
    id: faction.id,
    name: faction.name,
    theme: faction.motif,
    builtin: true,
    entries: (() => {
      const mapped = faction.members.flatMap(member => {
        const role = agencyRoleForExecutor(member.role)?.id
        const skin = skinIdForName(member.name)
        return role === undefined ? [] : [{ role, skin }]
      })
      // Minimal founding roster: product + visual UI + build + test + review only.
      // With eight cycling skins, two seats can hash to the same portrait: keep
      // the faction's own mapping when it is free, otherwise hand the seat the
      // next unused skin so the five founding seats stay visually distinct.
      const essential = ['product-manager', 'engineering-senior-developer', 'testing-evidence-collector', 'engineering-code-reviewer', 'design-ui-designer']
      const usedSkins = new Set<string>()
      const pickSkin = (preferred: string | undefined, seat: number): string => {
        if (preferred !== undefined && !usedSkins.has(preferred)) return preferred
        return (SKINS.find(candidate => !usedSkins.has(candidate.id)) ?? SKINS[seat % SKINS.length]!).id
      }
      return essential.map((role, seat) => {
        const skin = pickSkin(mapped.find(entry => entry.role === role)?.skin, seat)
        usedSkins.add(skin)
        return { role, skin }
      })
    })(),
  }))
  return [...factions, ...modePresetLineups()]
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

export function addLineupEntry(id: string, entry: LineupEntry): void {
  const lineup = lineupById(id)
  if (lineup === undefined) return
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
