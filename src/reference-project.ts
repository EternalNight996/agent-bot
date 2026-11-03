/**
 * 参考项目 (reference project) analysis.
 *
 * A founding user may point at a URL, a GitHub repo or a local path. The
 * analyzer reads only a small, fixed whitelist of engineering files and turns
 * them into two things:
 *  - a `ReferenceProfile`: detected stack + engineering habits (README shape,
 *    justfile recipes, directory layout, build/release wiring), and
 *  - `ReferenceDefaults`: inferred clarification defaults the interview shows,
 *    which the user may confirm, edit or clear.
 *
 * The profile is a LOW-priority default. User corrections are stored separately
 * in the founding bag and always win (see founding-bag.ts).
 *
 * Network access is bounded: every GitHub/URL read shares one deadline and any
 * failure degrades to a profile carrying the reason instead of throwing.
 */
import { readFile, readdir } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
import type { ClarifyReference, ReferenceKind } from './types.ts'

/** One normalized reference input. */
export interface ReferenceTarget {
  /** Exactly what the user typed. */
  readonly input: string
  readonly kind: ReferenceKind
  /** Short human label (repo, directory or page title). */
  readonly label: string
  /** Local absolute path, `owner/repo`, or URL. */
  readonly locator: string
}

export interface ReferenceStack {
  languages: string[]
  uiFramework?: string
  crossPlatform?: string
  targets: string[]
  buildSystem?: string
  testFramework?: string
  packageManagers: string[]
}

export interface ReferenceHabits {
  readmeSections: string[]
  hasJustfile: boolean
  justRecipes: string[]
  /** package.json scripts (name -> command), capped. */
  scripts: Record<string, string>
  dirs: string[]
  /** CI workflow file names. */
  ci: string[]
  /** Release/build wiring observed (tauri.conf.json, release scripts, workflows). */
  release: string[]
}

export interface ReferenceDefaults {
  platforms: string[]
  uiStyles: string[]
  constraints: string[]
  memoryHints: string[]
  notes: string[]
  verify: string[]
}

export interface ReferenceProfile {
  version: 1
  input: string
  kind: ReferenceKind
  label: string
  analyzedAt: number
  /** Present when part of the analysis failed (still usable, just thinner). */
  degraded?: string
  stack: ReferenceStack
  habits: ReferenceHabits
  inferred: ReferenceDefaults
  /** Files/signals that produced this profile, for audit. */
  evidence: string[]
  /** Compact prompt text (never the raw file dump). */
  digest: string
}

type FetchLike = typeof globalThis.fetch

const FILE_CAP = 64 * 1024
const README_HEADINGS_CAP = 12
const JUS_T_RECIPES_CAP = 12
const DIRS_CAP = 12

const PLATFORM_DESKTOP = ['Windows', 'macOS', 'Linux (UOS/麒麟)'] as const
const PLATFORM_MOBILE = ['Android', 'iOS'] as const

function unique(values: readonly (string | undefined)[], max = 16): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const text = (value ?? '').trim()
    if (text === '' || seen.has(text)) continue
    seen.add(text)
    out.push(text)
    if (out.length >= max) break
  }
  return out
}

function trimText(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max)
}

/** Classify one raw reference input. Unknown shapes degrade to a local path. */
export function classifyReference(raw: string, workspace: string): ReferenceTarget | undefined {
  const input = raw.trim()
  if (input === '') return undefined
  const githubUrl = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/i.exec(input)
  if (githubUrl !== null) {
    const owner = githubUrl[1] ?? ''
    const repo = githubUrl[2] ?? ''
    return { input, kind: 'github', label: owner + '/' + repo, locator: owner + '/' + repo }
  }
  const ssh = /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i.exec(input)
  if (ssh !== null) {
    const owner = ssh[1] ?? ''
    const repo = ssh[2] ?? ''
    return { input, kind: 'github', label: owner + '/' + repo, locator: owner + '/' + repo }
  }
  if (/^https?:\/\//i.test(input)) {
    let label = input
    try {
      const url = new URL(input)
      label = url.hostname + (url.pathname === '/' ? '' : url.pathname)
    } catch { /* keep raw */ }
    return { input, kind: 'url', label: trimText(label, 120), locator: input }
  }
  const looksLocal = /^[A-Za-z]:[\\/]/.test(input) || isAbsolute(input) || input.startsWith('.') || input.startsWith('~') || input.includes('\\')
  const absolute = resolve(workspace, input.startsWith('~') ? input.replace(/^~/, process.env['USERPROFILE'] ?? process.env['HOME'] ?? '~') : input)
  if (!looksLocal && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input)) {
    const [owner, repo] = input.split('/')
    if (owner !== undefined && repo !== undefined && owner !== '' && repo !== '') {
      return { input, kind: 'github', label: owner + '/' + repo, locator: owner + '/' + repo }
    }
  }
  return { input, kind: 'local', label: basename(absolute), locator: absolute }
}

async function readTextCapped(path: string): Promise<string | undefined> {
  try {
    const text = await readFile(path, 'utf8')
    return trimText(text, FILE_CAP)
  } catch {
    return undefined
  }
}

function extractReadmeSections(text: string): string[] {
  const sections: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^#{2,3}\s+(.+?)\s*$/.exec(line)
    if (match === null) continue
    const title = (match[1] ?? '').replace(/[#*`]/g, '').trim()
    if (title === '' || sections.includes(title)) continue
    sections.push(trimText(title, 40))
    if (sections.length >= README_HEADINGS_CAP) break
  }
  return sections
}

function extractJustRecipes(text: string): string[] {
  const recipes: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+)(?:\s+[^:]*)?:(?!=)/.exec(line)
    if (match === null) continue
    const name = match[1] ?? ''
    if (name === '' || name.startsWith('_') || recipes.includes(name)) continue
    recipes.push(name)
    if (recipes.length >= JUS_T_RECIPES_CAP) break
  }
  return recipes
}

function parsePackageJson(text: string | undefined): { scripts: Record<string, string>; deps: Record<string, string> } {
  if (text === undefined) return { scripts: {}, deps: {} }
  try {
    const parsed = JSON.parse(text) as { scripts?: Record<string, unknown>; dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> }
    const scripts: Record<string, string> = {}
    for (const [name, value] of Object.entries(parsed.scripts ?? {})) {
      if (typeof value !== 'string') continue
      scripts[name] = trimText(value, 120)
      if (Object.keys(scripts).length >= 10) break
    }
    const deps: Record<string, string> = {}
    for (const source of [parsed.dependencies, parsed.devDependencies]) {
      for (const [name, value] of Object.entries(source ?? {})) {
        if (typeof value === 'string') deps[name] = value
      }
    }
    return { scripts, deps }
  } catch {
    return { scripts: {}, deps: {} }
  }
}

interface SourceBag {
  readme?: string
  cargo?: string
  packageJson?: string
  justfile?: string
  tauriConf?: string
  pyproject?: string
  goMod?: string
  workflows: string[]
  dirs: string[]
  language?: string
  description?: string
}

function detectStack(bag: SourceBag): ReferenceStack {
  const pkg = parsePackageJson(bag.packageJson)
  const cargo = bag.cargo ?? ''
  // A URL page has no manifest files: its visible text is the only signal.
  const corpus = ((bag.readme ?? '') + ' ' + (bag.description ?? '')).toLowerCase()
  const languages: string[] = []
  if (cargo !== '' || bag.language === 'Rust') languages.push('Rust')
  if (bag.goMod !== undefined || bag.language === 'Go') languages.push('Go')
  if (bag.pyproject !== undefined || bag.language === 'Python') languages.push('Python')
  if (bag.packageJson !== undefined || bag.language === 'TypeScript' || bag.language === 'JavaScript') {
    languages.push(bag.language === 'TypeScript' || /"typescript"\s*:/.test(bag.packageJson ?? '') ? 'TypeScript' : 'JavaScript')
  }
  if (languages.length === 0 && bag.language !== undefined) languages.push(bag.language)
  if (languages.length === 0) {
    if (/\brust\b|cargo\.toml/.test(corpus)) languages.push('Rust')
    else if (/\bgolang\b|\bgo\b go\.mod/.test(corpus)) languages.push('Go')
    else if (/\bpython\b|pypi/.test(corpus)) languages.push('Python')
    else if (/typescript/.test(corpus)) languages.push('TypeScript')
    else if (/javascript/.test(corpus)) languages.push('JavaScript')
  }

  let uiFramework: string | undefined
  if (/\beframe\b|\begui\b/.test(cargo)) uiFramework = 'egui/eframe'
  else if (/\btauri\b/i.test(cargo) || pkg.deps['@tauri-apps/api'] !== undefined) uiFramework = 'Tauri'
  else if (pkg.deps['electron'] !== undefined) uiFramework = 'Electron'
  else if (pkg.deps['react'] !== undefined) uiFramework = 'React'
  else if (pkg.deps['vue'] !== undefined) uiFramework = 'Vue'
  else if (pkg.deps['svelte'] !== undefined) uiFramework = 'Svelte'
  else if (bag.pyproject !== undefined && /PySide|PyQt/i.test(bag.pyproject)) uiFramework = 'Qt (PySide/PyQt)'
  else if (/\begui\b|\beframe\b/.test(corpus)) uiFramework = 'egui/eframe'
  else if (/\btauri\b/.test(corpus)) uiFramework = 'Tauri'
  else if (/\belectron\b/.test(corpus)) uiFramework = 'Electron'
  else if (/\breact\b/.test(corpus)) uiFramework = 'React'
  else if (/\bvue\b/.test(corpus)) uiFramework = 'Vue'

  let crossPlatform: string | undefined
  let targets: string[] = []
  if (uiFramework === 'egui/eframe') { crossPlatform = 'egui/eframe 跨平台桌面'; targets = [...PLATFORM_DESKTOP] }
  else if (uiFramework === 'Tauri') { crossPlatform = 'Tauri 跨平台'; targets = [...PLATFORM_DESKTOP] }
  else if (uiFramework === 'Electron') { crossPlatform = 'Electron 跨平台'; targets = [...PLATFORM_DESKTOP] }
  else if (/\bflutter\b/i.test(bag.packageJson ?? '') || /\bflutter\b/i.test(bag.pyproject ?? '')) { crossPlatform = 'Flutter 跨平台'; targets = [...PLATFORM_DESKTOP, ...PLATFORM_MOBILE] }
  else if (uiFramework !== undefined && /桌面|desktop/i.test(bag.readme ?? '')) { crossPlatform = '桌面 GUI'; targets = [...PLATFORM_DESKTOP] }

  let buildSystem: string | undefined
  if (bag.justfile !== undefined) buildSystem = 'just'
  else if (cargo !== '') buildSystem = 'cargo'
  else if (bag.packageJson !== undefined) buildSystem = 'pnpm/npm'
  else if (bag.goMod !== undefined) buildSystem = 'go'
  else if (bag.pyproject !== undefined) buildSystem = 'python'

  let testFramework: string | undefined
  if (cargo !== '' && /\[dev-dependencies\]|\btest\b/.test(cargo)) testFramework = 'cargo test'
  else if (pkg.deps['vitest'] !== undefined) testFramework = 'vitest'
  else if (pkg.deps['jest'] !== undefined) testFramework = 'jest'
  else if (bag.pyproject !== undefined && /pytest/.test(bag.pyproject)) testFramework = 'pytest'

  const packageManagers = unique([
    cargo !== '' ? 'cargo' : undefined,
    bag.packageJson !== undefined ? 'npm' : undefined,
    bag.justfile !== undefined ? 'just' : undefined,
    bag.pyproject !== undefined ? 'pip' : undefined,
    bag.goMod !== undefined ? 'go' : undefined,
  ])

  return {
    languages,
    ...uiFramework === undefined ? {} : { uiFramework },
    ...crossPlatform === undefined ? {} : { crossPlatform },
    targets,
    ...buildSystem === undefined ? {} : { buildSystem },
    ...testFramework === undefined ? {} : { testFramework },
    packageManagers,
  }
}

function detectHabits(bag: SourceBag): ReferenceHabits {
  const pkg = parsePackageJson(bag.packageJson)
  const justRecipes = bag.justfile === undefined ? [] : extractJustRecipes(bag.justfile)
  const release: string[] = []
  if (bag.tauriConf !== undefined) release.push('tauri.conf.json（跨平台打包配置）')
  if (Object.keys(pkg.scripts).some(name => /release|publish|package/i.test(name))) release.push('package.json 发布脚本')
  if (bag.workflows.some(name => /release|publish|package/i.test(name))) release.push('CI 发布工作流')
  if (release.length === 0 && justRecipes.some(name => /release|publish|package|bundle/i.test(name))) release.push('just 发布配方')
  return {
    readmeSections: bag.readme === undefined ? [] : extractReadmeSections(bag.readme),
    hasJustfile: bag.justfile !== undefined,
    justRecipes,
    scripts: pkg.scripts,
    dirs: bag.dirs,
    ci: bag.workflows,
    release,
  }
}

function buildDefaults(stack: ReferenceStack, habits: ReferenceHabits, label: string): ReferenceDefaults {
  const stackSummary = unique([...stack.languages, stack.uiFramework, stack.crossPlatform]).join(' / ')
  const verify = unique([
    ...(habits.justRecipes.includes('build') ? ['just build'] : []),
    ...(habits.justRecipes.includes('test') ? ['just test'] : []),
    ...(habits.justRecipes.includes('check') ? ['just check'] : []),
    ...(habits.justRecipes.length === 0 && stack.languages.includes('Rust') ? ['cargo check', 'cargo test'] : []),
    ...(habits.justRecipes.length === 0 && habits.scripts['test'] !== undefined ? ['npm test'] : []),
  ])
  const constraints = unique([
    '参考项目：' + label + (stackSummary === '' ? '' : '（' + stackSummary + '）'),
    ...(stack.crossPlatform === undefined ? [] : ['跨平台方案沿用参考项目：' + stack.crossPlatform]),
    ...(habits.hasJustfile ? ['工程命令沿用参考项目的 just 习惯'] : []),
    ...(habits.readmeSections.length === 0 ? [] : ['README 结构参考：' + habits.readmeSections.slice(0, 5).join(' / ')]),
    ...(habits.release.length === 0 ? [] : ['构建发布方式参考：' + habits.release.join('；')]),
  ], 10)
  const notes = unique([
    habits.hasJustfile ? 'just 配方：' + (habits.justRecipes.join(', ') || '（未解析出配方）') : undefined,
    habits.dirs.length === 0 ? undefined : '目录：' + habits.dirs.slice(0, 8).join(' '),
    habits.ci.length === 0 ? undefined : 'CI：' + habits.ci.join(', '),
    Object.keys(habits.scripts).length === 0 ? undefined : '脚本：' + Object.entries(habits.scripts).slice(0, 6).map(([name]) => name).join(', '),
    stack.testFramework === undefined ? undefined : '测试：' + stack.testFramework,
  ], 8)
  return {
    platforms: [...stack.targets],
    uiStyles: stack.uiFramework === undefined ? [] : stack.targets.includes('Android') || stack.targets.includes('iOS') ? ['移动端触控优先'] : ['桌面端传统'],
    constraints,
    memoryHints: unique([label, ...stack.languages, stack.uiFramework, stack.crossPlatform, habits.hasJustfile ? 'just' : undefined], 10),
    notes,
    verify,
  }
}

/** Compact prompt text; capped so a huge README can never flood a prompt. */
export function referenceDigest(profile: ReferenceProfile): string {
  const stack = unique([...profile.stack.languages, profile.stack.uiFramework, profile.stack.crossPlatform]).join(' / ')
  const defaults = profile.inferred
  return trimText([
    '参考项目：' + profile.label + '（' + profile.kind + (profile.degraded === undefined ? '' : '，部分信号缺失：' + profile.degraded) + '）',
    '技术栈：' + (stack === '' ? '未识别' : stack),
    '工程习惯：' + [
      profile.habits.hasJustfile ? 'justfile（' + (profile.habits.justRecipes.join('/') || '无配方') + '）' : '',
      profile.habits.readmeSections.length === 0 ? '' : 'README 章节（' + profile.habits.readmeSections.slice(0, 6).join(' / ') + '）',
      profile.habits.dirs.length === 0 ? '' : '目录（' + profile.habits.dirs.slice(0, 8).join(' ') + '）',
      profile.habits.release.length === 0 ? '' : '发布（' + profile.habits.release.join('；') + '）',
    ].filter(item => item !== '').join('；'),
    '推断默认：' + [
      defaults.platforms.length === 0 ? '' : '平台=' + defaults.platforms.join('/'),
      defaults.uiStyles.length === 0 ? '' : '风格=' + defaults.uiStyles.join('/'),
      defaults.verify.length === 0 ? '' : '验证=' + defaults.verify.join('；'),
    ].filter(item => item !== '').join('；'),
    '约束提示：' + (defaults.constraints.join('；') || '无'),
    '注意：参考项目是低优先级默认值，用户修正优先。',
  ].filter(line => line !== '').join('\n'), 1800)
}

/** Durable marker persisted on the clarification / constitution. */
export function clarifyReferenceOf(profile: ReferenceProfile): ClarifyReference {
  return {
    input: profile.input,
    kind: profile.kind,
    label: profile.label,
    ...profile.stack.languages.length === 0 ? {} : { stack: unique([...profile.stack.languages, profile.stack.uiFramework, profile.stack.crossPlatform], 8) },
  }
}

function stripHtml(html: string): { title: string; text: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const title = titleMatch === null ? '' : decodeEntities(titleMatch[1] ?? '').replace(/\s+/g, ' ').trim()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  return { title: trimText(title, 120), text: trimText(decodeEntities(text).replace(/\s+/g, ' ').trim(), 20_000) }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function fetchText(fetchImpl: FetchLike, url: string, signal: AbortSignal): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'dsh-super-agent/reference-analysis', accept: 'text/plain,text/html,application/json;q=0.9,*/*;q=0.8' },
    signal,
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  return trimText(await response.text(), FILE_CAP)
}

async function readLocalSources(locator: string): Promise<SourceBag & { missing: boolean }> {
  const bag: SourceBag = { workflows: [], dirs: [] }
  let missing = false
  try {
    const entries = await readdir(locator, { withFileTypes: true })
    bag.dirs = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'target')
      .map(entry => entry.name + '/')
      .slice(0, DIRS_CAP)
  } catch {
    missing = true
  }
  if (missing) return { ...bag, missing: true }
  const read = async (name: string): Promise<string | undefined> => readTextCapped(join(locator, name))
  const readme = await read('README.md') ?? await read('README_ZH.md') ?? await read('readme.md') ?? await read('README.rst')
  const cargo = await read('Cargo.toml')
  const packageJson = await read('package.json')
  const justfile = await read('justfile') ?? await read('Justfile')
  const tauriConf = await read('tauri.conf.json')
  const pyproject = await read('pyproject.toml')
  const goMod = await read('go.mod')
  const workflows: string[] = []
  try {
    const entries = await readdir(join(locator, '.github', 'workflows'), { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && workflows.length < 8) workflows.push(entry.name)
    }
  } catch { /* no CI */ }
  return {
    ...readme === undefined ? {} : { readme },
    ...cargo === undefined ? {} : { cargo },
    ...packageJson === undefined ? {} : { packageJson },
    ...justfile === undefined ? {} : { justfile },
    ...tauriConf === undefined ? {} : { tauriConf },
    ...pyproject === undefined ? {} : { pyproject },
    ...goMod === undefined ? {} : { goMod },
    workflows,
    dirs: bag.dirs,
    missing: false,
  }
}

async function readGithubSources(target: ReferenceTarget, deps: { fetchImpl: FetchLike; signal: AbortSignal }): Promise<SourceBag & { missing: boolean; degraded?: string }> {
  const [owner, repo] = target.locator.split('/')
  if (owner === undefined || repo === undefined) return { workflows: [], dirs: [], missing: true, degraded: '无效的 GitHub 仓库名' }
  const bag: SourceBag = { workflows: [], dirs: [] }
  const problems: string[] = []
  const metaUrl = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo)
  try {
    const raw = await fetchText(deps.fetchImpl, metaUrl, deps.signal)
    const meta = JSON.parse(raw) as { language?: unknown; description?: unknown; default_branch?: unknown; topics?: unknown }
    if (typeof meta.language === 'string') bag.language = meta.language
    if (typeof meta.description === 'string') bag.description = trimText(meta.description, 200)
  } catch (error: unknown) {
    problems.push('仓库元数据：' + messageOf(error))
  }
  const base = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/HEAD/'
  const fetchFile = async (name: string): Promise<string | undefined> => {
    try {
      return await fetchText(deps.fetchImpl, base + name, deps.signal)
    } catch {
      return undefined
    }
  }
  const readme = await fetchFile('README.md') ?? await fetchFile('readme.md')
  const cargo = await fetchFile('Cargo.toml')
  const packageJson = await fetchFile('package.json')
  const justfile = await fetchFile('justfile')
  const tauriConf = await fetchFile('tauri.conf.json')
  const pyproject = await fetchFile('pyproject.toml')
  const goMod = await fetchFile('go.mod')
  const found = [readme, cargo, packageJson, justfile, tauriConf, pyproject, goMod].filter(item => item !== undefined).length
  if (found === 0) problems.push('仓库文件：未能读取 README/Cargo.toml/package.json 等任一文件（可能需要网络或仓库不可公开访问）')
  return {
    ...readme === undefined ? {} : { readme },
    ...cargo === undefined ? {} : { cargo },
    ...packageJson === undefined ? {} : { packageJson },
    ...justfile === undefined ? {} : { justfile },
    ...tauriConf === undefined ? {} : { tauriConf },
    ...pyproject === undefined ? {} : { pyproject },
    ...goMod === undefined ? {} : { goMod },
    workflows: [],
    dirs: [],
    missing: found === 0,
    ...problems.length === 0 ? {} : { degraded: problems.join('；') },
  }
}

async function readUrlSources(target: ReferenceTarget, deps: { fetchImpl: FetchLike; signal: AbortSignal }): Promise<SourceBag & { missing: boolean; degraded?: string }> {
  try {
    const raw = await fetchText(deps.fetchImpl, target.locator, deps.signal)
    const { title, text } = stripHtml(raw)
    const keywords = ['Rust', 'egui', 'Tauri', 'Electron', 'React', 'Vue', 'Svelte', 'Flutter', 'Python', 'Go', 'just', '跨平台', '桌面', 'README']
    const found = unique(keywords.filter(keyword => text.toLowerCase().includes(keyword.toLowerCase())))
    return {
      readme: text,
      ...title === '' ? {} : { description: title },
      workflows: [],
      dirs: [],
      missing: false,
      ...found.length === 0 ? {} : { degraded: '页面未出现可识别的技术栈关键词' },
    }
  } catch (error: unknown) {
    return { workflows: [], dirs: [], missing: true, degraded: '页面抓取失败：' + messageOf(error) }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Analyze one reference input. Local paths must exist; network sources degrade. */
export async function analyzeReference(
  workspace: string,
  raw: string | ReferenceTarget,
  deps?: { fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<ReferenceProfile> {
  const target = typeof raw === 'string' ? classifyReference(raw, workspace) : raw
  if (target === undefined) throw new Error('参考项目不能为空')
  const timeoutMs = deps?.timeoutMs ?? 12_000
  const fetchImpl = deps?.fetchImpl ?? globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, timeoutMs)
  let bag: SourceBag & { missing: boolean; degraded?: string }
  try {
    if (target.kind === 'local') {
      bag = await readLocalSources(target.locator)
    } else if (target.kind === 'github') {
      bag = await readGithubSources(target, { fetchImpl, signal: controller.signal })
    } else {
      bag = await readUrlSources(target, { fetchImpl, signal: controller.signal })
    }
  } finally {
    clearTimeout(timer)
  }
  // A local path that does not exist is a user error, not a degraded network read.
  if (target.kind === 'local' && bag.missing) throw new Error('参考项目路径不存在：' + target.locator)

  const stack = detectStack(bag)
  const habits = detectHabits(bag)
  const inferred = buildDefaults(stack, habits, target.label)
  if (bag.description !== undefined && bag.description !== target.label) inferred.notes = unique([bag.description, ...inferred.notes], 8)
  const evidence: string[] = []
  if (bag.readme !== undefined) evidence.push('README')
  if (bag.cargo !== undefined) evidence.push('Cargo.toml')
  if (bag.packageJson !== undefined) evidence.push('package.json')
  if (bag.justfile !== undefined) evidence.push('justfile')
  if (bag.tauriConf !== undefined) evidence.push('tauri.conf.json')
  if (bag.pyproject !== undefined) evidence.push('pyproject.toml')
  if (bag.goMod !== undefined) evidence.push('go.mod')
  if (bag.workflows.length > 0) evidence.push('.github/workflows')
  if (bag.language !== undefined) evidence.push('GitHub language=' + bag.language)
  const profile: ReferenceProfile = {
    version: 1,
    input: target.input,
    kind: target.kind,
    label: target.label,
    analyzedAt: Date.now(),
    ...bag.degraded === undefined ? {} : { degraded: bag.degraded },
    stack,
    habits,
    inferred,
    evidence,
    digest: '',
  }
  profile.digest = referenceDigest(profile)
  return profile
}
