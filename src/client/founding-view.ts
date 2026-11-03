/**
 * Client-side view of 参考项目 / 三界行囊 payloads.
 *
 * This module is pure (no React, no fetch) so the founding dialog can stay a
 * view over the host data and the layering rules are testable in isolation:
 *
 *   reference profile (low)  <  remembered corrections / current edits (high)
 */
export type ReferenceKindView = 'local' | 'github' | 'url'

export interface ReferenceDefaultsView {
  platforms: string[]
  uiStyles: string[]
  constraints: string[]
  memoryHints: string[]
  notes: string[]
  verify: string[]
}

export interface ReferenceStackView {
  languages: string[]
  uiFramework?: string
  crossPlatform?: string
  targets: string[]
  buildSystem?: string
  testFramework?: string
  packageManagers: string[]
}

export interface ReferenceHabitsView {
  readmeSections: string[]
  hasJustfile: boolean
  justRecipes: string[]
  scripts: Record<string, string>
  dirs: string[]
  ci: string[]
  release: string[]
}

export interface ReferenceProfileView {
  version: 1
  input: string
  kind: ReferenceKindView
  label: string
  analyzedAt: number
  degraded?: string
  stack: ReferenceStackView
  habits: ReferenceHabitsView
  inferred: ReferenceDefaultsView
  evidence: string[]
  digest: string
}

export interface FoundingCorrectionsView {
  platforms?: string[]
  uiStyles?: string[]
  constraints?: string[]
  memoryHints?: string[]
}

export interface RememberedReferenceView {
  input: string
  kind: ReferenceKindView
  label?: string
  analyzedAt?: number
  profile?: ReferenceProfileView
}

export interface FoundingBagView {
  version: 1
  doctrine?: string
  ambition?: string
  mode?: string
  reference?: RememberedReferenceView
  corrections?: FoundingCorrectionsView
  updatedAt: number
}

/** The reference defaults the user currently accepts (editable chips). */
export interface ReferenceSelection {
  platforms: string[]
  uiStyles: string[]
  constraints: string[]
}

function strings(value: unknown, cap = 16, each = 200): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const text = item.trim().slice(0, each)
    if (text === '' || seen.has(text)) continue
    seen.add(text)
    out.push(text)
    if (out.length >= cap) break
  }
  return out
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/** Lenient parse of one analyzed reference profile from the host. */
export function asReferenceProfile(value: unknown): ReferenceProfileView | undefined {
  const raw = recordOf(value)
  if (raw['version'] !== 1) return undefined
  const stack = recordOf(raw['stack'])
  const habits = recordOf(raw['habits'])
  const inferred = recordOf(raw['inferred'])
  const scripts: Record<string, string> = {}
  for (const [name, command] of Object.entries(recordOf(habits['scripts'])).slice(0, 10)) {
    if (typeof command === 'string') scripts[name.slice(0, 40)] = command.slice(0, 120)
  }
  return {
    version: 1,
    input: typeof raw['input'] === 'string' ? raw['input'] : '',
    kind: raw['kind'] === 'github' || raw['kind'] === 'url' ? raw['kind'] : 'local',
    label: typeof raw['label'] === 'string' ? raw['label'] : '',
    analyzedAt: typeof raw['analyzedAt'] === 'number' ? raw['analyzedAt'] : 0,
    ...typeof raw['degraded'] === 'string' ? { degraded: raw['degraded'] } : {},
    stack: {
      languages: strings(stack['languages'], 8),
      targets: strings(stack['targets'], 6),
      packageManagers: strings(stack['packageManagers'], 6),
      ...typeof stack['uiFramework'] === 'string' ? { uiFramework: stack['uiFramework'] } : {},
      ...typeof stack['crossPlatform'] === 'string' ? { crossPlatform: stack['crossPlatform'] } : {},
      ...typeof stack['buildSystem'] === 'string' ? { buildSystem: stack['buildSystem'] } : {},
      ...typeof stack['testFramework'] === 'string' ? { testFramework: stack['testFramework'] } : {},
    },
    habits: {
      readmeSections: strings(habits['readmeSections'], 12, 80),
      hasJustfile: habits['hasJustfile'] === true,
      justRecipes: strings(habits['justRecipes'], 12, 60),
      scripts,
      dirs: strings(habits['dirs'], 12, 60),
      ci: strings(habits['ci'], 8, 80),
      release: strings(habits['release'], 8, 120),
    },
    inferred: {
      platforms: strings(inferred['platforms'], 8),
      uiStyles: strings(inferred['uiStyles'], 8),
      constraints: strings(inferred['constraints'], 10),
      memoryHints: strings(inferred['memoryHints'], 12),
      notes: strings(inferred['notes'], 8),
      verify: strings(inferred['verify'], 8),
    },
    evidence: strings(raw['evidence'], 12, 80),
    digest: typeof raw['digest'] === 'string' ? raw['digest'] : '',
  }
}

/** Lenient parse of one inferred-defaults payload from the host. */
export function asReferenceDefaults(value: unknown): ReferenceDefaultsView | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw['platforms']) && !Array.isArray(raw['constraints'])) return undefined
  return {
    platforms: strings(raw['platforms'], 8),
    uiStyles: strings(raw['uiStyles'], 8),
    constraints: strings(raw['constraints'], 10),
    memoryHints: strings(raw['memoryHints'], 12),
    notes: strings(raw['notes'], 8),
    verify: strings(raw['verify'], 8),
  }
}

/** Lenient parse of the remembered founding bag from the host. */
export function asFoundingBag(value: unknown): FoundingBagView | undefined {
  const raw = recordOf(value)
  if (raw['version'] !== 1) return undefined
  const referenceRaw = recordOf(raw['reference'])
  const referenceInput = typeof referenceRaw['input'] === 'string' ? referenceRaw['input'] : ''
  const profile = asReferenceProfile(referenceRaw['profile'])
  const correctionsRaw = recordOf(raw['corrections'])
  const corrections: FoundingCorrectionsView = {
    ...Array.isArray(correctionsRaw['platforms']) ? { platforms: strings(correctionsRaw['platforms'], 8) } : {},
    ...Array.isArray(correctionsRaw['uiStyles']) ? { uiStyles: strings(correctionsRaw['uiStyles'], 8) } : {},
    ...Array.isArray(correctionsRaw['constraints']) ? { constraints: strings(correctionsRaw['constraints'], 10) } : {},
    ...Array.isArray(correctionsRaw['memoryHints']) ? { memoryHints: strings(correctionsRaw['memoryHints'], 12) } : {},
  }
  return {
    version: 1,
    ...typeof raw['doctrine'] === 'string' ? { doctrine: raw['doctrine'] } : {},
    ...typeof raw['ambition'] === 'string' ? { ambition: raw['ambition'] } : {},
    ...typeof raw['mode'] === 'string' ? { mode: raw['mode'] } : {},
    ...referenceInput === '' ? {} : {
      reference: {
        input: referenceInput,
        kind: referenceRaw['kind'] === 'github' || referenceRaw['kind'] === 'url' ? referenceRaw['kind'] as ReferenceKindView : 'local' as const,
        ...typeof referenceRaw['label'] === 'string' ? { label: referenceRaw['label'] } : {},
        ...typeof referenceRaw['analyzedAt'] === 'number' ? { analyzedAt: referenceRaw['analyzedAt'] } : {},
        ...profile === undefined ? {} : { profile },
      },
    },
    ...Object.keys(corrections).length === 0 ? {} : { corrections },
    updatedAt: typeof raw['updatedAt'] === 'number' ? raw['updatedAt'] : 0,
  }
}

/**
 * Reference defaults after the high-priority corrections were applied.
 * Mirrors the host's layerReferenceDefaults so the wizard shows one truth.
 */
export function layeredDefaults(bag: FoundingBagView | undefined): ReferenceDefaultsView | undefined {
  const profile = bag?.reference?.profile
  if (profile === undefined) return undefined
  const defaults: ReferenceDefaultsView = { ...profile.inferred }
  const corrections = bag?.corrections
  if (corrections === undefined) return defaults
  if (corrections.platforms !== undefined) defaults.platforms = [...corrections.platforms]
  if (corrections.uiStyles !== undefined) defaults.uiStyles = [...corrections.uiStyles]
  if (corrections.constraints !== undefined) defaults.constraints = [...corrections.constraints]
  if (corrections.memoryHints !== undefined) defaults.memoryHints = [...corrections.memoryHints]
  return defaults
}

/** Initial editable selection from layered defaults. */
export function selectionOf(defaults: ReferenceDefaultsView | undefined): ReferenceSelection {
  return {
    platforms: [...(defaults?.platforms ?? [])],
    uiStyles: [...(defaults?.uiStyles ?? [])],
    constraints: [...(defaults?.constraints ?? [])],
  }
}

/**
 * Durable clarification marker for the confirmed reference input. Only the
 * compact summary is persisted; raw files never enter team.json.
 */
export function referenceMarker(profile: ReferenceProfileView | undefined, input: string): { input: string; kind: ReferenceKindView; label?: string; stack?: string[] } | undefined {
  const text = input.trim()
  if (text === '') return undefined
  if (profile === undefined) return { input: text, kind: 'local' }
  const stack = [...new Set([...profile.stack.languages, profile.stack.uiFramework, profile.stack.crossPlatform].filter((item): item is string => item !== undefined && item !== ''))].slice(0, 8)
  return {
    input: text.slice(0, 500),
    kind: profile.kind,
    ...profile.label === '' ? {} : { label: profile.label },
    ...stack.length === 0 ? {} : { stack },
  }
}

function unique(values: readonly string[], max = 30): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const text = value.trim()
    if (text === '' || seen.has(text)) continue
    seen.add(text)
    out.push(text)
    if (out.length >= max) break
  }
  return out
}

export interface ClarificationMergeInput {
  /** Mode/heuristic baseline (platforms/acceptance/excluded already set). */
  base: Record<string, unknown>
  doctrine: string
  /** Optional emphasis; absent when 视觉爆炸 is off. */
  ambition?: string
  referenceInput: string
  profile?: ReferenceProfileView
  selection?: ReferenceSelection
  interviewNotes: string[]
  platformAnswers: string[]
  projectKindNote: string
}

/**
 * Merge the user's interview + reference selections into the clarification the
 * wizard submits. User selections always win; reference values are added on
 * top of the mode baseline, never replacing the user's own answers.
 */
export function mergeClarification(input: ClarificationMergeInput): Record<string, unknown> {
  const base = input.base
  const basePlatforms = strings(base['platforms'], 8)
  const baseConstraints = strings(base['constraints'], 20)
  const baseMemoryHints = strings(base['memoryHints'], 12)
  const baseUi = typeof base['ui'] === 'object' && base['ui'] !== null ? base['ui'] as Record<string, unknown> : {}
  const selected = input.selection
  const platforms = unique([...basePlatforms, ...selected?.platforms ?? [], ...input.platformAnswers], 8)
  const constraints = unique([...baseConstraints, input.projectKindNote, ...selected?.constraints ?? [], ...input.interviewNotes], 20)
  return {
    ...base,
    doctrine: input.doctrine,
    ...input.ambition === undefined || input.ambition === '' ? {} : { ambition: input.ambition },
    ...referenceMarker(input.profile, input.referenceInput) === undefined ? {} : { reference: referenceMarker(input.profile, input.referenceInput) },
    platforms,
    constraints,
    memoryHints: unique([...baseMemoryHints, ...(input.profile?.inferred.memoryHints ?? [])], 12),
    ui: {
      ...baseUi,
      styles: unique(selected?.uiStyles ?? [], 8),
    },
  }
}
