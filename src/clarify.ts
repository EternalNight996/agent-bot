/**
 * Blocking requirement clarification captured before a DAG is generated.
 *
 * The wizard renders the fixed seven-section form; the captain tool accepts the
 * same object from chat. Nothing in the plan pipeline runs until this object is
 * complete and confirmed by the user.
 */
import type { ClarifyReference, ReferenceKind, TeamClarification } from './types.ts'
import { DEFAULT_MODE, getModeSpec, isTeamMode, modeLabel } from './modes.ts'
import { DEFAULT_DOCTRINE, doctrineName, isDoctrineId } from './doctrine.ts'
import { ambitionName, isAmbitionId } from './ambition.ts'
import { factionById, isFactionId } from './factions.ts'

export const CLARIFY_SCALES = ['small', 'medium', 'fullstack'] as const
export const CLARIFY_PLATFORMS = ['Windows', 'Linux (UOS/麒麟)', 'macOS', 'Android', 'iOS'] as const
export const CLARIFY_UI_STYLES = ['工业极简', '桌面端传统', '移动端触控优先', '科技感大屏'] as const

/**
 * AI-proposed answers for the clarification form. The section structure stays
 * fixed; these lists are tailored to the requirement by the model.
 */
export interface ClarifyOptions {
  readonly source: 'ai' | 'fallback'
  readonly type: 'hardware' | 'software'
  readonly scale: 'small' | 'medium' | 'fullstack'
  readonly ui: {
    readonly references: string[]
    readonly styles: string[]
    readonly notes: string[]
  }
  readonly platforms: string[]
  readonly hardware: string[]
  readonly constraints: string[]
  readonly excluded: string[]
  readonly acceptance: string[]
  readonly memoryHints: string[]
}

const SCALE_LABEL: Record<TeamClarification['scale'], string> = {
  small: '🟢 小改动/单点突破（1-3 天）',
  medium: '🟡 多模块联动（1-2 周）',
  fullstack: '🔴 全栈重写（按月）',
}

const TYPE_LABEL: Record<TeamClarification['type'], string> = {
  hardware: '软硬开发',
  software: '纯软件开发',
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(field + ' must be an array')
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item !== '')
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(field + ' must be a string')
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

const REFERENCE_KINDS: readonly ReferenceKind[] = ['local', 'github', 'url']
const MAX_REFERENCE_INPUT = 500
const MAX_REFERENCE_LABEL = 200

/**
 * Validate the durable reference-project marker. The raw input is capped so a
 * pasted file dump can never bloat team.json or the constitution.
 */
export function normalizeClarifyReference(value: unknown): ClarifyReference | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') {
    const input = value.trim()
    return input === '' ? undefined : { input: input.slice(0, MAX_REFERENCE_INPUT), kind: 'local' }
  }
  if (typeof value !== 'object') throw new Error('clarification.reference must be an object or a string')
  const raw = value as Record<string, unknown>
  const input = typeof raw['input'] === 'string' ? raw['input'].trim() : ''
  if (input === '') return undefined
  const kind = (REFERENCE_KINDS as readonly string[]).includes(String(raw['kind']))
    ? raw['kind'] as ReferenceKind
    : 'local'
  const label = typeof raw['label'] === 'string' ? raw['label'].trim().slice(0, MAX_REFERENCE_LABEL) : ''
  const stack = Array.isArray(raw['stack'])
    ? raw['stack'].filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(item => item !== '').slice(0, 12)
    : []
  return {
    input: input.slice(0, MAX_REFERENCE_INPUT),
    kind,
    ...label === '' ? {} : { label },
    ...stack.length === 0 ? {} : { stack },
  }
}

/** Validate and normalize one clarification payload from the UI or a tool call. */
export function normalizeClarification(value: unknown): TeamClarification {
  if (typeof value !== 'object' || value === null) throw new Error('clarification must be an object')
  const raw = value as Record<string, unknown>
  // Legacy payloads have no mode: the current DEFAULT_MODE (draft) applies.
  const mode = isTeamMode(raw['mode']) ? raw['mode'] : DEFAULT_MODE
  const type = raw['type']
  if (type !== 'hardware' && type !== 'software') throw new Error('clarification.type must be "hardware" or "software"')
  const scale = raw['scale']
  if (scale !== 'small' && scale !== 'medium' && scale !== 'fullstack') {
    throw new Error('clarification.scale must be "small", "medium" or "fullstack"')
  }
  const uiRaw = raw['ui']
  if (typeof uiRaw !== 'object' || uiRaw === null) throw new Error('clarification.ui must be an object')
  const ui = uiRaw as Record<string, unknown>
  const styles = stringArray(ui['styles'] ?? [], 'clarification.ui.styles')
  const platforms = stringArray(raw['platforms'] ?? [], 'clarification.platforms')
  if (platforms.length === 0) throw new Error('clarification.platforms must select at least one platform')
  const acceptance = stringArray(raw['acceptance'] ?? [], 'clarification.acceptance')
  if (acceptance.length === 0) throw new Error('clarification.acceptance must contain at least one executable criterion')
  const constraints = stringArray(raw['constraints'] ?? [], 'clarification.constraints')
  const excluded = stringArray(raw['excluded'] ?? [], 'clarification.excluded')
  const hardwareList = stringArray(raw['hardwareList'] ?? [], 'clarification.hardwareList')
  const memoryHints = stringArray(raw['memoryHints'] ?? [], 'clarification.memoryHints')
  const modeSpec = getModeSpec(mode)
  const excludedMerged = excluded.length > 0 ? excluded : [...modeSpec.defaultExcluded]
  // 法脉 is the durable default (功能直交). 宏愿 is OPTIONAL: it exists only
  // when the user explicitly turns it on, so an unselected ambition injects
  // nothing into the constitution or the prompts.
  const doctrine = isDoctrineId(raw['doctrine']) ? raw['doctrine'] : DEFAULT_DOCTRINE
  const faction = isFactionId(raw['faction']) ? raw['faction'] : undefined
  const ambition = isAmbitionId(raw['ambition']) ? raw['ambition'] : undefined
  const reference = normalizeClarifyReference(raw['reference'])
  return {
    type,
    scale,
    mode,
    ...faction === undefined ? {} : { faction },
    doctrine,
    ...ambition === undefined ? {} : { ambition },
    ...reference === undefined ? {} : { reference },
    ui: {
      ...optionalString(ui['reference'], 'clarification.ui.reference') === undefined
        ? {}
        : { reference: optionalString(ui['reference'], 'clarification.ui.reference') as string },
      styles,
      ...optionalString(ui['notes'], 'clarification.ui.notes') === undefined
        ? {}
        : { notes: optionalString(ui['notes'], 'clarification.ui.notes') as string },
    },
    platforms,
    hardwareList,
    constraints,
    excluded: excludedMerged,
    acceptance,
    memoryHints,
  }
}

/** Render the fixed seven-section clarification form the user confirmed. */
export function describeClarification(clarification: TeamClarification): string {
  const lines: string[] = []
  const faction = factionById(clarification.faction)
  if (faction !== undefined) lines.push('【阵营皮肤】' + faction.name + '（' + faction.motif + '）')
  lines.push('【法脉】' + doctrineName(clarification.doctrine) + '（' + (isDoctrineId(clarification.doctrine) ? clarification.doctrine : DEFAULT_DOCTRINE) + '）')
  if (isAmbitionId(clarification.ambition)) {
    lines.push('【宏愿】' + ambitionName(clarification.ambition) + '（' + clarification.ambition + '）')
  }
  if (clarification.reference !== undefined) {
    lines.push('【参考项目】' + (clarification.reference.label ?? clarification.reference.input)
      + (clarification.reference.stack === undefined || clarification.reference.stack.length === 0 ? '' : '；技术栈：' + clarification.reference.stack.join(' / ')))
  }
  lines.push('【开发模式】' + modeLabel(clarification.mode) + ' ' + getModeSpec(clarification.mode).name)
  lines.push('【类型】' + TYPE_LABEL[clarification.type])
  lines.push('【项目规模】' + SCALE_LABEL[clarification.scale])
  const reference = clarification.ui.reference === undefined ? '无参照' : clarification.ui.reference
  const styles = clarification.ui.styles.length === 0 ? '未选' : clarification.ui.styles.join(' / ')
  lines.push('【UI设计】参照物：' + reference + '；风格：' + styles
    + (clarification.ui.notes === undefined ? '' : '；补充：' + clarification.ui.notes))
  lines.push('【目标平台】' + clarification.platforms.join(' / '))
  lines.push('【硬件清单】' + (clarification.hardwareList.length === 0 ? '无（纯软件）' : clarification.hardwareList.join('；')))
  lines.push('【禁止边界】' + clarification.excluded.join('；'))
  lines.push('【验收断言】' + clarification.acceptance.join('；'))
  return lines.join('\n')
}
