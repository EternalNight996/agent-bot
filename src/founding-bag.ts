/**
 * 三界行囊 (founding bag): the cross-session memory of how this workspace
 * likes to found sects.
 *
 * It remembers the last 法脉 (doctrine), 宏愿 (ambition), development mode and
 * reference project, plus the user's corrections to reference-inferred
 * defaults. Two layers are kept apart on purpose:
 *
 *   reference profile  — low priority, re-derived from files each analysis
 *   user corrections   — high priority, never overwritten by a new analysis
 *
 * The bag is workspace-scoped (`.pixel-team/bag.json`) and best-effort: a
 * corrupt or oversized bag is ignored instead of blocking a founding.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AmbitionId } from './ambition.ts'
import { isAmbitionId } from './ambition.ts'
import type { DoctrineId } from './doctrine.ts'
import { isDoctrineId } from './doctrine.ts'
import type { TeamMode } from './modes.ts'
import { isTeamMode } from './modes.ts'
import type { ReferenceKind } from './types.ts'
import type { ReferenceDefaults, ReferenceProfile } from './reference-project.ts'

export const FOUNDING_BAG_DIR = '.pixel-team'
export const FOUNDING_BAG_FILE = 'bag.json'

const MAX_INPUT = 500
const MAX_LABEL = 200
const MAX_DIGEST = 1800
const MAX_LIST = 16

const REFERENCE_KINDS: readonly ReferenceKind[] = ['local', 'github', 'url']

/** User edits to reference-inferred defaults; always outrank the profile. */
export interface FoundingCorrections {
  platforms?: string[]
  uiStyles?: string[]
  constraints?: string[]
  memoryHints?: string[]
}

/** Last analyzed reference project, cached so a new session can reuse it. */
export interface RememberedReference {
  input: string
  kind: ReferenceKind
  label?: string
  analyzedAt?: number
  profile?: ReferenceProfile
}

export interface FoundingBag {
  version: 1
  doctrine?: DoctrineId
  ambition?: AmbitionId
  mode?: TeamMode
  reference?: RememberedReference
  corrections?: FoundingCorrections
  updatedAt: number
}

function strings(value: unknown, cap = MAX_LIST, each = 160): string[] {
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

function sanitizeProfile(value: unknown): ReferenceProfile | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>
  if (raw['version'] !== 1) return undefined
  const stackRaw = typeof raw['stack'] === 'object' && raw['stack'] !== null ? raw['stack'] as Record<string, unknown> : {}
  const inferredRaw = typeof raw['inferred'] === 'object' && raw['inferred'] !== null ? raw['inferred'] as Record<string, unknown> : {}
  const habitsRaw = typeof raw['habits'] === 'object' && raw['habits'] !== null ? raw['habits'] as Record<string, unknown> : {}
  const targets = strings(stackRaw['targets'], 8, 40)
  const inferred: ReferenceDefaults = {
    platforms: strings(inferredRaw['platforms'], 8, 40),
    uiStyles: strings(inferredRaw['uiStyles'], 8, 60),
    constraints: strings(inferredRaw['constraints'], 10, 200),
    memoryHints: strings(inferredRaw['memoryHints'], 12, 80),
    notes: strings(inferredRaw['notes'], 8, 200),
    verify: strings(inferredRaw['verify'], 8, 120),
  }
  const scripts: Record<string, string> = {}
  if (typeof habitsRaw['scripts'] === 'object' && habitsRaw['scripts'] !== null) {
    for (const [name, command] of Object.entries(habitsRaw['scripts'] as Record<string, unknown>).slice(0, 10)) {
      if (typeof command === 'string') scripts[name.slice(0, 40)] = command.slice(0, 120)
    }
  }
  const stack: ReferenceProfile['stack'] = {
    languages: strings(stackRaw['languages'], 6, 40),
    targets,
    packageManagers: strings(stackRaw['packageManagers'], 6, 20),
    ...typeof stackRaw['uiFramework'] === 'string' ? { uiFramework: stackRaw['uiFramework'].slice(0, 60) } : {},
    ...typeof stackRaw['crossPlatform'] === 'string' ? { crossPlatform: stackRaw['crossPlatform'].slice(0, 60) } : {},
    ...typeof stackRaw['buildSystem'] === 'string' ? { buildSystem: stackRaw['buildSystem'].slice(0, 60) } : {},
    ...typeof stackRaw['testFramework'] === 'string' ? { testFramework: stackRaw['testFramework'].slice(0, 60) } : {},
  }
  const habits: ReferenceProfile['habits'] = {
    readmeSections: strings(habitsRaw['readmeSections'], 12, 60),
    hasJustfile: habitsRaw['hasJustfile'] === true,
    justRecipes: strings(habitsRaw['justRecipes'], 12, 60),
    scripts,
    dirs: strings(habitsRaw['dirs'], 12, 60),
    ci: strings(habitsRaw['ci'], 8, 80),
    release: strings(habitsRaw['release'], 8, 120),
  }
  const profile: ReferenceProfile = {
    version: 1,
    input: typeof raw['input'] === 'string' ? raw['input'].slice(0, MAX_INPUT) : '',
    kind: (REFERENCE_KINDS as readonly string[]).includes(String(raw['kind'])) ? raw['kind'] as ReferenceKind : 'local',
    label: typeof raw['label'] === 'string' ? raw['label'].slice(0, MAX_LABEL) : '',
    analyzedAt: typeof raw['analyzedAt'] === 'number' ? raw['analyzedAt'] : 0,
    stack,
    habits,
    inferred,
    evidence: strings(raw['evidence'], 12, 80),
    digest: typeof raw['digest'] === 'string' ? raw['digest'].slice(0, MAX_DIGEST) : '',
  }
  return profile
}

function sanitizeReference(value: unknown): RememberedReference | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>
  const input = typeof raw['input'] === 'string' ? raw['input'].trim() : ''
  if (input === '') return undefined
  const profile = sanitizeProfile(raw['profile'])
  return {
    input: input.slice(0, MAX_INPUT),
    kind: (REFERENCE_KINDS as readonly string[]).includes(String(raw['kind'])) ? raw['kind'] as ReferenceKind : 'local',
    ...typeof raw['label'] === 'string' && raw['label'].trim() !== '' ? { label: raw['label'].trim().slice(0, MAX_LABEL) } : {},
    ...typeof raw['analyzedAt'] === 'number' ? { analyzedAt: raw['analyzedAt'] } : {},
    ...profile === undefined ? {} : { profile },
  }
}

/** Validate untrusted correction payloads from the Web route. */
export function normalizeFoundingCorrections(value: unknown): FoundingCorrections | undefined {
  return sanitizeCorrections(value)
}

function sanitizeCorrections(value: unknown): FoundingCorrections | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>
  const corrections: FoundingCorrections = {
    ...Array.isArray(raw['platforms']) ? { platforms: strings(raw['platforms'], 8, 40) } : {},
    ...Array.isArray(raw['uiStyles']) ? { uiStyles: strings(raw['uiStyles'], 8, 60) } : {},
    ...Array.isArray(raw['constraints']) ? { constraints: strings(raw['constraints'], 10, 200) } : {},
    ...Array.isArray(raw['memoryHints']) ? { memoryHints: strings(raw['memoryHints'], 12, 80) } : {},
  }
  return Object.keys(corrections).length === 0 ? undefined : corrections
}

/** Validate an untrusted bag object; undefined when it is unusable. */
export function sanitizeFoundingBag(value: unknown): FoundingBag | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>
  const reference = sanitizeReference(raw['reference'])
  const corrections = sanitizeCorrections(raw['corrections'])
  const bag: FoundingBag = {
    version: 1,
    updatedAt: typeof raw['updatedAt'] === 'number' ? raw['updatedAt'] : Date.now(),
  }
  if (isDoctrineId(raw['doctrine'])) bag.doctrine = raw['doctrine']
  if (isAmbitionId(raw['ambition'])) bag.ambition = raw['ambition']
  if (isTeamMode(raw['mode'])) bag.mode = raw['mode']
  if (reference !== undefined) bag.reference = reference
  if (corrections !== undefined) bag.corrections = corrections
  return bag
}

/** Absolute path of this workspace's founding bag. */
export function foundingBagPath(workspace: string): string {
  return join(workspace, FOUNDING_BAG_DIR, FOUNDING_BAG_FILE)
}

/** Read the remembered bag; missing or corrupt files read as undefined. */
export async function readFoundingBag(workspace: string): Promise<FoundingBag | undefined> {
  try {
    const text = await readFile(foundingBagPath(workspace), 'utf8')
    return sanitizeFoundingBag(JSON.parse(text))
  } catch {
    return undefined
  }
}

/** Write the bag atomically (temp file + rename). */
export async function writeFoundingBag(workspace: string, bag: FoundingBag): Promise<FoundingBag> {
  const clean = sanitizeFoundingBag({ ...bag, version: 1, updatedAt: Date.now() }) ?? { version: 1, updatedAt: Date.now() }
  const target = foundingBagPath(workspace)
  await mkdir(join(workspace, FOUNDING_BAG_DIR), { recursive: true })
  const temp = target + '.tmp-' + process.pid
  await writeFile(temp, JSON.stringify(clean, null, 2) + '\n', 'utf8')
  await rename(temp, target)
  return clean
}

export interface FoundingPatch {
  doctrine?: DoctrineId
  /** undefined keeps the previous ambition; null clears it (emphasis off). */
  ambition?: AmbitionId | null
  mode?: TeamMode
  /** undefined keeps the previous reference; null clears it. */
  reference?: RememberedReference | null
  /** undefined keeps the previous corrections; null clears them. */
  corrections?: FoundingCorrections | null
}

/**
 * Merge one founding decision into the remembered bag.
 * @returns the persisted bag.
 */
export async function rememberFounding(workspace: string, patch: FoundingPatch): Promise<FoundingBag> {
  const previous = await readFoundingBag(workspace) ?? { version: 1 as const, updatedAt: Date.now() }
  const next: FoundingBag = { version: 1, updatedAt: Date.now() }
  const doctrine = patch.doctrine ?? previous.doctrine
  const ambition = patch.ambition === null ? undefined : patch.ambition ?? previous.ambition
  const mode = patch.mode ?? previous.mode
  if (doctrine !== undefined) next.doctrine = doctrine
  if (ambition !== undefined) next.ambition = ambition
  if (mode !== undefined) next.mode = mode
  if (patch.reference === null) {
    // Explicit clear: "用户清空则不参考".
  } else if (patch.reference !== undefined) {
    const reference = sanitizeReference(patch.reference)
    if (reference !== undefined) next.reference = reference
  } else if (previous.reference !== undefined) {
    next.reference = previous.reference
  }
  if (patch.corrections === null) {
    // Explicit clear of user corrections.
  } else if (patch.corrections !== undefined) {
    const corrections = sanitizeCorrections(patch.corrections)
    if (corrections !== undefined) next.corrections = corrections
  } else if (previous.corrections !== undefined) {
    next.corrections = previous.corrections
  }
  return writeFoundingBag(workspace, next)
}

/** Reference defaults after the high-priority user corrections were applied. */
export interface LayeredDefaults {
  defaults: ReferenceDefaults
  /** Categories the user overrode ("platforms" | "uiStyles" | ...). */
  overridden: string[]
}

/**
 * Layer the user's corrections over the reference profile.
 * A corrected category REPLACES the inferred one; it is never merged back.
 */
export function layerReferenceDefaults(defaults: ReferenceDefaults, corrections?: FoundingCorrections): LayeredDefaults {
  if (corrections === undefined) return { defaults, overridden: [] }
  const overridden: string[] = []
  const next: ReferenceDefaults = { ...defaults }
  if (corrections.platforms !== undefined) { next.platforms = [...corrections.platforms]; overridden.push('platforms') }
  if (corrections.uiStyles !== undefined) { next.uiStyles = [...corrections.uiStyles]; overridden.push('uiStyles') }
  if (corrections.constraints !== undefined) { next.constraints = [...corrections.constraints]; overridden.push('constraints') }
  if (corrections.memoryHints !== undefined) { next.memoryHints = [...corrections.memoryHints]; overridden.push('memoryHints') }
  return { defaults: next, overridden }
}
