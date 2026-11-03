/**
 * Development modes: one source of truth for philosophy, default boundaries,
 * acceptance, verifier strategy, failure limits and budget.
 *
 * Every module reads this table instead of scattering mode branches.
 *
 * The founding UI only offers the three outward modes (quick experience,
 * standard delivery, strict delivery). legacy/monetize remain valid stored
 * values for old teams and advanced compatibility, but are never offered by
 * the main UI and do not contribute an acceptance baseline.
 */
export const TEAM_MODES = ['draft', 'analysis', 'plan', 'precision', 'legacy', 'compliance', 'monetize', 'stress'] as const
export type TeamMode = typeof TEAM_MODES[number]

/** The modes the founding UI offers, in experience order. */
export const PRIMARY_MODES = ['draft', 'analysis', 'plan', 'precision', 'compliance', 'stress'] as const

/** Default without an explicit user choice: the fast experience. */
export const DEFAULT_MODE: TeamMode = 'draft'

export type VerifierStrategy = 'smoke' | 'unit-network' | 'legacy-regression' | 'compliance-audit'

export interface ModeSpec {
  readonly id: TeamMode
  readonly labelKey: string
  /** Server-side Chinese name (prompts/constitution). */
  readonly name: string
  readonly emoji: string
  readonly color: string
  /** Injected at the very front of every member System Prompt. */
  readonly philosophy: string
  readonly defaultExcluded: readonly string[]
  readonly acceptanceDefaults: readonly string[]
  /** Strict checks the user may explicitly tick on top of the defaults. */
  readonly optionalAcceptance: readonly string[]
  readonly verifier: {
    readonly strategy: VerifierStrategy
    readonly failLimit: number
    /** Legacy: a failing old regression suite blocks immediately. */
    readonly blockOnOldTestFail: boolean
  }
  readonly budget: {
    readonly perTaskUsd: number
    readonly perDayUsd: number
    /** Retry count at which the UI asks for human triage. */
    readonly retryPromptAt: number
  }
}

/** 开发模式是策略层：新建任务选什么模式，就按什么策略调度/审计/生成计划语法。 */
export interface ModeStrategy {
  readonly maxParallel: number
  readonly audit: 'light' | 'standard' | 'strict'
  readonly grammar: string
}

export const MODE_STRATEGIES: Record<TeamMode, ModeStrategy> = {
  draft: { maxParallel: 4, audit: 'light', grammar: '目标 → 最短主线 → 冒烟 → 交付；只保留必要验证。' },
  analysis: { maxParallel: 2, audit: 'light', grammar: '范围 → 并行取证 → 证据汇总 → 结论；不写代码、不改工作区。' },
  plan: { maxParallel: 2, audit: 'light', grammar: '目标 → 阶段拆分 → 依赖/风险 → 验收/回滚；只产出可执行计划。' },
  precision: { maxParallel: 2, audit: 'standard', grammar: '需求 → 实现 → 验证 → 审查 → 交付；关键路径必须有自动化证据。' },
  legacy: { maxParallel: 2, audit: 'standard', grammar: '旧接口回归 → 最小修复 → 新单测 → 对外行为不变；只加不改。' },
  compliance: { maxParallel: 1, audit: 'strict', grammar: '边界审计 → 串行实现 → 合规验证 → 独立审查；所有操作可审计。' },
  monetize: { maxParallel: 4, audit: 'light', grammar: '主流程变现 → License 校验 → 华丽 UI 复用 → 快速交付。' },
  stress: { maxParallel: 8, audit: 'standard', grammar: '压测目标 → 隔离环境施压 → 指标采集（P95/错误率/资源）→ 瓶颈定位 → 回归建议；先设上限与熔断。' },
}

export function modeStrategy(mode: TeamMode | undefined): ModeStrategy {
  return MODE_STRATEGIES[mode ?? DEFAULT_MODE]
}

export const MODE_SPECS: Record<TeamMode, ModeSpec> = {
  stress: {
    id: 'stress',
    labelKey: 'mode.stress',
    name: '压力测试',
    emoji: '🔥',
    color: '#ff7a45',
    philosophy: '你是压力测试工程师：先在隔离环境设定并发/时长/数据量上限与熔断阈值，再施压；采集 P95/P99、错误率、CPU/内存/连接数曲线；瓶颈结论必须有数据支撑，禁止对生产环境施压、禁止无限并发、禁止修改业务数据。',
    defaultExcluded: ['禁止对生产环境施压', '禁止无上限并发', '禁止修改业务数据'],
    acceptanceDefaults: ['压测脚本可重复执行', '关键指标（P95/错误率/资源）已采集', '瓶颈结论有数据支撑'],
    optionalAcceptance: [],
    verifier: { strategy: 'unit-network', failLimit: 3, blockOnOldTestFail: false },
    budget: { perTaskUsd: 4, perDayUsd: 60, retryPromptAt: 3 },
  },
  draft: {
    id: 'draft',
    labelKey: 'mode.draft',
    name: '快速体验',
    emoji: '⚡',
    color: '#6fb6ff',
    philosophy: '你是快速体验工程师：优先让主流程跑通并可见；允许硬编码与临时绕过；非主流程缺陷先记录不阻塞，不引入新依赖。',
    defaultExcluded: ['禁止过度设计', '不写非冒烟测试', '不引入新依赖'],
    acceptanceDefaults: ['主流程跑通', '关键交互可点击'],
    optionalAcceptance: [],
    verifier: { strategy: 'smoke', failLimit: 2, blockOnOldTestFail: false },
    budget: { perTaskUsd: 1, perDayUsd: 15, retryPromptAt: 2 },
  },
  analysis: {
    id: 'analysis',
    labelKey: 'mode.analysis',
    name: '分析模式',
    emoji: '🔍',
    color: '#8ab4ff',
    philosophy: '你是快速分析专家：只做分析与结论，不修改任何文件、不写代码。快速覆盖需求、现状、数据、风险与未知；每条结论必须挂证据或明确假设，未知项直接写未知，不编造。',
    defaultExcluded: ['不修改工作区', '不写代码', '不跳过证据'],
    acceptanceDefaults: ['分析范围与结论逐条对应', '每条结论有证据或明确假设'],
    optionalAcceptance: [],
    verifier: { strategy: 'smoke', failLimit: 2, blockOnOldTestFail: false },
    budget: { perTaskUsd: 1, perDayUsd: 15, retryPromptAt: 2 },
  },
  plan: {
    id: 'plan',
    labelKey: 'mode.plan',
    name: '计划模式',
    emoji: '🗺️',
    color: '#b9a6ff',
    philosophy: '你是快速计划专家：只产出可执行计划，不修改任何文件、不写代码。计划必须覆盖目标、阶段、任务、依赖、风险、验收与回滚；先给最短可执行路径，再列可选扩展，快速但全面。',
    defaultExcluded: ['不修改工作区', '不写代码', '不跳过验收与回滚'],
    acceptanceDefaults: ['计划覆盖目标/阶段/依赖/风险/验收', '每个阶段可执行且可验证'],
    optionalAcceptance: [],
    verifier: { strategy: 'smoke', failLimit: 2, blockOnOldTestFail: false },
    budget: { perTaskUsd: 1, perDayUsd: 15, retryPromptAt: 2 },
  },
  precision: {
    id: 'precision',
    labelKey: 'mode.precision',
    name: '标准交付',
    emoji: '🏭',
    color: '#f2c14e',
    philosophy: '你是标准交付工程师：任何外部调用必须有超时与异常捕获；禁止吞异常、禁止硬编码绕过；关键路径必须有自动化验证。长跑与断网演练只在用户明确要求时加入。',
    defaultExcluded: ['禁止吞异常', '禁止硬编码绕过', '禁止跳过失败用例'],
    acceptanceDefaults: ['异常路径有捕获', '关键路径有自动化验证', '无内存泄漏'],
    optionalAcceptance: [],
    verifier: { strategy: 'unit-network', failLimit: 3, blockOnOldTestFail: false },
    budget: { perTaskUsd: 3, perDayUsd: 50, retryPromptAt: 3 },
  },
  legacy: {
    id: 'legacy',
    labelKey: 'mode.legacy',
    name: '屎山抢救',
    emoji: '🔧',
    color: '#c79bff',
    philosophy: '你是外科医生：只加不改。禁止重构底层、禁止修改原有接口协议、禁止删除旧测试；任何新代码必须先有旧接口回归测试保护。',
    defaultExcluded: ['禁止重构底层', '禁止修改原有接口协议', '禁止删除旧测试'],
    acceptanceDefaults: ['旧接口回归测试 100% 通过', '新代码单测通过', '对外行为不变'],
    optionalAcceptance: [],
    verifier: { strategy: 'legacy-regression', failLimit: 3, blockOnOldTestFail: true },
    budget: { perTaskUsd: 3, perDayUsd: 50, retryPromptAt: 3 },
  },
  compliance: {
    id: 'compliance',
    labelKey: 'mode.compliance',
    name: '严格交付',
    emoji: '🛡️',
    color: '#7fd6a8',
    philosophy: '你是合规审计员：零外部依赖风险；禁止访问公网、禁止打印明文密码/token、禁止引入未经审核的第三方包；所有操作必须可审计。',
    defaultExcluded: ['禁止访问公网', '禁止打印明文密码', '禁止引入未审核第三方包'],
    acceptanceDefaults: ['无新增未审核依赖', '日志无明文 password/token', '操作审计已开启'],
    optionalAcceptance: ['断网自动重连', '72h 连续运行无崩溃'],
    verifier: { strategy: 'compliance-audit', failLimit: 3, blockOnOldTestFail: false },
    budget: { perTaskUsd: 3, perDayUsd: 50, retryPromptAt: 3 },
  },
  monetize: {
    id: 'monetize',
    labelKey: 'mode.monetize',
    name: '交付变现',
    emoji: '💰',
    color: '#ffb86b',
    philosophy: '你是交付变现负责人：UI 优先复用现成华丽模板；核心功能必须接入授权校验；砍掉不直接产生收入的边缘功能。',
    defaultExcluded: ['不加非变现功能', '不引入未授权 SDK', '不做无收益重构'],
    acceptanceDefaults: ['主流程可交互', 'License 校验生效'],
    optionalAcceptance: [],
    verifier: { strategy: 'smoke', failLimit: 2, blockOnOldTestFail: false },
    budget: { perTaskUsd: 1, perDayUsd: 15, retryPromptAt: 2 },
  },
}

/** Is this value one of the five stored modes? */
export function isTeamMode(value: unknown): value is TeamMode {
  return typeof value === 'string' && (TEAM_MODES as readonly string[]).includes(value)
}

/** Main-UI equivalent for a stored/advanced mode (legacy/monetize map to standard delivery). */
export function primaryModeOf(mode: TeamMode | undefined): TeamMode {
  if (mode === 'legacy' || mode === 'monetize') return 'precision'
  return mode !== undefined && isTeamMode(mode) ? mode : DEFAULT_MODE
}

/** Resolve a spec; unknown/missing values fall back to DEFAULT_MODE (draft). */
export function getModeSpec(mode: TeamMode | undefined): ModeSpec {
  return MODE_SPECS[mode !== undefined && isTeamMode(mode) ? mode : DEFAULT_MODE]
}

/** Default acceptance plus the mode's explicit opt-in strict checks. */
export function modeAcceptanceOptions(mode: TeamMode | undefined): string[] {
  const spec = getModeSpec(mode)
  return [...spec.acceptanceDefaults, ...spec.optionalAcceptance]
}

/**
 * Only an explicit strong delivery mode contributes its acceptance baseline.
 * draft (the default) and the compatibility-only modes never append defaults.
 */
export function modeAddsAcceptanceBaseline(mode: TeamMode | undefined): boolean {
  return mode === 'precision' || mode === 'compliance' || mode === 'analysis' || mode === 'plan' || mode === 'stress'
}

/** Human label for prompts and the constitution. */
export function modeLabel(mode: TeamMode | undefined): string {
  const spec = getModeSpec(mode)
  return spec.emoji + ' ' + spec.id
}

/** The philosophy block prepended to every member persona. */
export function modePhilosophyText(mode: TeamMode | undefined): string {
  const spec = getModeSpec(mode)
  return [
    '【开发模式：' + spec.emoji + ' ' + spec.id + '】',
    spec.philosophy,
    '禁止边界：' + spec.defaultExcluded.join('；') + '。',
    '验收基线：' + spec.acceptanceDefaults.join('；') + '。',
  ].join('\n')
}
