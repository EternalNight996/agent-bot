/** Click-to-dispatch entry: a header button that stages a plan from a small wizard. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import css from './QuickStartDialog.module.css'
import { memberArtUrl } from './artwork.ts'
import { useCustomRoles } from './custom-roles.ts'
import { useHiddenLineups } from './hidden-lineups.ts'
import { OPEN_HALL_START_EVENT } from './hall-events.ts'
import type { AgentTeamsTranslate } from './locales.ts'
import { TEAM_CREATED_EVENT } from './team-reveal.ts'
import { useLineups, lineupById } from './lineup-store.ts'
import { modeLineupId } from './mode-lineups.ts'
import { ALL_SKINS } from './skins.ts'
import { useCustomSkins } from './custom-skins.ts'
import { useHiddenSkins } from './hidden-skins.ts'
import { useRoleAgents } from './role-agents.ts'
import { useRolePrompts } from './role-prompts.ts'
import { agencyRole } from '../agency-roles-lite.ts'
import { useCustomAgencyRoles, type CustomAgencyRole } from './custom-agency-roles.ts'
import { InterviewSheet, type InterviewQuestionView } from './InterviewSheet.tsx'
import { DEFAULT_MODE, PRIMARY_MODES, getModeSpec, isTeamMode, modeAcceptanceOptions, primaryModeOf, type TeamMode } from '../modes.ts'
import {
  asFoundingBag,
  asReferenceDefaults,
  asReferenceProfile,
  layeredDefaults,
  mergeClarification,
  selectionOf,
  type FoundingBagView,
  type ReferenceProfileView,
  type ReferenceSelection,
} from './founding-view.ts'
import { pickDirectoryPath } from './directory-picker.ts'


type TplKey = 'quickstart.tplFix' | 'quickstart.tplFeat' | 'quickstart.tplShip' | 'quickstart.tplResearch' | 'quickstart.tplAudit' | 'quickstart.tplFullstack' | 'quickstart.tplDrama'
  | 'quickstart.tplHardening' | 'quickstart.tplBuild' | 'quickstart.tplArray' | 'quickstart.tplDocs' | 'quickstart.tplDebate'

interface QuickTemplate {
  readonly id: string
  readonly labelKey: TplKey
  readonly descKey: string
  readonly roles: readonly string[]
}

const TEMPLATES: readonly QuickTemplate[] = [
  // Five doctrine types only: the drama workflow (and the extra templates)
  // stay server-side for compatibility and rollback, but the founding UI no
  // longer offers them. 功能直交 is first so it is the default 法脉.
  { id: 'ship', labelKey: 'quickstart.tplShip', descKey: 'quickstart.desc.ship', roles: ['implementer'] },
  { id: 'feat', labelKey: 'quickstart.tplFeat', descKey: 'quickstart.desc.feat', roles: ['planner', 'implementer', 'verifier', 'reviewer'] },
  { id: 'fix', labelKey: 'quickstart.tplFix', descKey: 'quickstart.desc.fix', roles: ['implementer', 'verifier', 'reviewer'] },
  { id: 'research', labelKey: 'quickstart.tplResearch', descKey: 'quickstart.desc.research', roles: ['researcher', 'analyst', 'writer', 'reviewer'] },
  { id: 'audit', labelKey: 'quickstart.tplAudit', descKey: 'quickstart.desc.audit', roles: ['auditor', 'reviewer'] },
]

/** 单人角色的默认优先级：优先能独立执行实现的角色，再退到该模式阵容的其它角色。 */
const SOLO_ROLE_PREFERENCE = [
  'engineering-senior-developer',
  'engineering-frontend-developer',
  'engineering-backend-architect',
  'security-appsec-engineer',
  'design-ux-researcher',
  'product-manager',
  'engineering-software-architect',
]

/** 单人可选角色：沿用当前模式阵容里的岗位，保证模式和角色不脱节。 */
function soloCandidatesFor(mode: TeamMode): string[] {
  const preset = lineupById(modeLineupId(mode))
  return [...new Set((preset?.entries ?? []).map(entry => entry.role))]
}

function preferredSoloRole(candidates: readonly string[]): string {
  return SOLO_ROLE_PREFERENCE.find(role => candidates.includes(role)) ?? candidates[0] ?? 'implementer'
}

function normalizedSoloRole(value: string | undefined, mode: TeamMode): string {
  const candidates = soloCandidatesFor(mode)
  return value !== undefined && candidates.includes(value) ? value : preferredSoloRole(candidates)
}

type GoalAttachment = { readonly name: string; readonly path: string; readonly mime: string; readonly kind: 'image' | 'video'; readonly size: number }

type QuickStartDraft = {
  step: number
  mode: TeamMode
  goal: string
  template: string
  /** 视觉爆炸 is fixed in the 目标 step; kept for draft compatibility. */
  ambition: string
  roles: string[]
  /** 当前阵容（开发模式的预设）；单人时不使用。 */
  faction?: string
  projectKind: 'engineering' | 'drama'
  solo: boolean
  /** 单人模式执行的单个角色 id。 */
  soloRole?: string
  superFast: boolean
  questions: InterviewQuestionView[]
  answers: Record<string, string[]>
  referenceInput: string
  attachments?: GoalAttachment[]
  referenceProfile?: ReferenceProfileView
  referenceSelection?: ReferenceSelection
  submitting: boolean
  submittedAt: number
}

/** Parse a persisted editable reference selection. */
function readSelection(value: unknown): ReferenceSelection | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>
  const list = (item: unknown): string[] => Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === 'string') : []
  return { platforms: list(raw['platforms']), uiStyles: list(raw['uiStyles']), constraints: list(raw['constraints']) }
}

const QUICK_START_DRAFT_PREFIX = 'dsh-super-agent.quickstart.'

function readQuickStartDraft(sessionId: string): QuickStartDraft | undefined {
  try {
    const raw = window.localStorage.getItem(QUICK_START_DRAFT_PREFIX + sessionId)
    if (raw === null) return undefined
    const value = JSON.parse(raw) as Partial<QuickStartDraft>
    if (typeof value !== 'object' || value === null) return undefined
    return {
      step: typeof value.step === 'number' ? value.step : 0,
      // Stored legacy/monetize drafts map onto the standard delivery card.
      mode: isTeamMode(value.mode) ? primaryModeOf(value.mode) : DEFAULT_MODE,
      goal: typeof value.goal === 'string' ? value.goal : '',
      // Legacy drama drafts (template:'drama') resume on the first offered doctrine.
      template: typeof value.template === 'string' && TEMPLATES.some(entry => entry.id === value.template)
        ? value.template
        : (TEMPLATES[0]?.id ?? 'fix'),
      // Optional UI emphasis; off unless the draft explicitly enabled it.
      ambition: value.ambition === 'visual' ? 'visual' : '',
      roles: Array.isArray(value.roles) ? value.roles.filter((role): role is string => typeof role === 'string') : [...(TEMPLATES[0]?.roles ?? [])],
      faction: typeof value.faction === 'string' && value.faction.trim() !== '' ? value.faction : undefined,
      // Legacy 'drama' drafts still load, but founding is engineering-only now.
      projectKind: 'engineering',
      solo: value.solo === true,
      soloRole: typeof value.soloRole === 'string' && value.soloRole.trim() !== '' ? value.soloRole : undefined,
      superFast: value.superFast === true,
      questions: Array.isArray(value.questions) ? value.questions as InterviewQuestionView[] : [],
      answers: typeof value.answers === 'object' && value.answers !== null ? value.answers as Record<string, string[]> : {},
      referenceInput: typeof value.referenceInput === 'string' ? value.referenceInput : '',
      ...Array.isArray(value.attachments) ? {
        attachments: value.attachments.flatMap((item): GoalAttachment[] => {
          if (typeof item !== 'object' || item === null) return []
          const record = item as Record<string, unknown>
          const path = typeof record['path'] === 'string' ? record['path'] : ''
          const kind = record['kind'] === 'image' || record['kind'] === 'video' ? record['kind'] : undefined
          if (path === '' || kind === undefined) return []
          return [{
            name: typeof record['name'] === 'string' ? record['name'] : path.split('/').pop() ?? path,
            path,
            mime: typeof record['mime'] === 'string' ? record['mime'] : '',
            kind,
            size: typeof record['size'] === 'number' ? record['size'] : 0,
          }]
        }).slice(0, 20),
      } : {},
      ...asReferenceProfile(value.referenceProfile) === undefined ? {} : { referenceProfile: asReferenceProfile(value.referenceProfile) },
      ...readSelection(value.referenceSelection) === undefined ? {} : { referenceSelection: readSelection(value.referenceSelection) },
      submitting: value.submitting === true,
      submittedAt: typeof value.submittedAt === 'number' ? value.submittedAt : 0,
    }
  } catch {
    return undefined
  }
}

function saveQuickStartDraft(sessionId: string, draft: QuickStartDraft): void {
  try { window.localStorage.setItem(QUICK_START_DRAFT_PREFIX + sessionId, JSON.stringify(draft)) } catch { /* private mode */ }
}

function clearQuickStartDraft(sessionId: string): void {
  try { window.localStorage.removeItem(QUICK_START_DRAFT_PREFIX + sessionId) } catch { /* private mode */ }
}

async function fileToBase64(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('could not read attachment'))
    reader.readAsDataURL(file)
  })
}

async function findRecentStagedTeam(sessionId: string, since: number, signal?: AbortSignal): Promise<{ teamId: string; name: string } | undefined> {
  try {
    const response = await fetch('/plugins/dsh-super-agent/state', { cache: 'no-store', ...signal === undefined ? {} : { signal } })
    const body = await response.json() as { teams?: Array<{ teamId?: string; name?: string; teamName?: string; captainSessionId?: string; phase?: string; createdAt?: number }> }
    const found = (body.teams ?? []).find(team => team.captainSessionId === sessionId
      && team.phase === 'staged'
      && (team.createdAt ?? 0) >= since - 5_000)
    if (found?.teamId === undefined) return undefined
    return { teamId: found.teamId, name: found.teamName ?? found.name ?? found.teamId }
  } catch {
    return undefined
  }
}
/** 组队步骤：目标（开发模式 + 单人/团队 + 视觉爆炸 + 复刻项目） → 拍板（需求 + 摘要）。
 * 阵容不再单独成步：它由目标里的开发模式派生，滚动条同时切换模式与队伍。
 * 法脉（任务模板）同样不再让用户选：功能直交是固定默认值。 */
const STEPS = ['vow', 'board'] as const
type Step = typeof STEPS[number]
const STEP_LABEL: Record<Step, 'quickstart.stepGoal' | 'quickstart.stepBoard'> = {
  vow: 'quickstart.stepGoal',
  board: 'quickstart.stepBoard',
}

/** Template questions used only when the host/model cannot answer. */
function fallbackInterviewQuestions(mode: TeamMode): InterviewQuestionView[] {
  const spec = getModeSpec(mode)
  return [
    { id: 'platform', prompt: '目标运行平台？', multi: true, options: ['Windows', 'Linux (UOS/麒麟)', 'macOS', 'Android', 'iOS'] },
    { id: 'acceptance', prompt: '验收以哪条为准？', multi: true, options: modeAcceptanceOptions(mode) },
    { id: 'excluded', prompt: '哪些事情明确不做？', multi: true, options: [...spec.defaultExcluded] },
  ]
}

/** Minimum valid clarification when the answer route is unavailable. */
function fallbackClarification(mode: TeamMode): Record<string, unknown> {
  const spec = getModeSpec(mode)
  return {
    type: 'software',
    scale: 'small',
    mode,
    ui: { styles: [] },
    platforms: ['Windows'],
    hardwareList: [],
    constraints: [],
    excluded: [...spec.defaultExcluded],
    acceptance: [...spec.acceptanceDefaults],
    memoryHints: [],
  }
}

export function QuickStartWizard({ sessionId, existingTeam, t, onDone, onFounded }: {
  readonly sessionId: SessionId
  /** The hall already knows a sect exists: confirm before replacing it. */
  readonly existingTeam?: boolean
  readonly t: AgentTeamsTranslate
  readonly onDone?: () => void
  readonly onFounded?: () => void
}) {
  const [draft] = useState(() => readQuickStartDraft(sessionId))
  const customRoles = useCustomRoles()
  const hiddenLineups = useHiddenLineups()
  const lineups = useLineups()
  const agents = useRoleAgents()
  const rolePrompts = useRolePrompts()
  const customAgencyRoles = useCustomAgencyRoles()
  const roleDef = (role: string): { name: string; agent: string; executor: string; skills: readonly string[] } | undefined => {
    const builtin = agencyRole(role)
    if (builtin !== undefined) return builtin
    return customAgencyRoles.find(entry => entry.id === role)
  }
  const customSkins = useCustomSkins()
  const hiddenSkins = useHiddenSkins()
  const skinLookup = useMemo(() => new Map([
    ...ALL_SKINS.filter(skin => !hiddenSkins.includes(skin.id)),
    ...customSkins,
  ].map(skin => [skin.id, skin])), [customSkins, hiddenSkins])
  const visibleFactions = lineups.filter(def => !hiddenLineups.includes(def.id))
  const [step, setStep] = useState(() => draft?.step ?? 0)
  // Development mode drives polish, options, constitution and the member persona.
  const [mode, setMode] = useState<TeamMode>(() => draft?.mode ?? DEFAULT_MODE)
  // Compatibility only: the task-type picker is gone, founding is always engineering.
  const [projectKind] = useState<'engineering' | 'drama'>(() => draft?.projectKind ?? 'engineering')
  const [goal, setGoal] = useState(() => draft?.goal ?? '')
  // 玄门道统（法脉）选项已移除：固定功能直交，只保留 draft/bag 的兼容字段。
  const [template, setTemplate] = useState<string>('ship')
  // 每个开发模式都自带一张阵容预设（人数/职责随模式变化）。阵容不再是独立步骤：
  // 滚动条切模式时同步切到该模式预设；单人模式则清空阵容，由师父一个角色执行。
  const modeLineupFor = (value: TeamMode): string | undefined => {
    const id = modeLineupId(value)
    return visibleFactions.some(lineup => lineup.id === id) ? id : undefined
  }
  const initialFaction: string | undefined = (() => {
    const saved = draft?.faction
    if (saved !== undefined && visibleFactions.some(lineup => lineup.id === saved)) return saved
    return modeLineupFor(mode) ?? visibleFactions[0]?.id
  })()
  const initialFactionRoles = initialFaction === undefined
    ? undefined
    : lineupById(initialFaction)?.entries.map(entry => entry.role)
  // Solo run: no members are spawned; the captain executes every task itself.
  const [solo, setSolo] = useState(() => draft?.solo ?? false)
  const [soloRole, setSoloRole] = useState<string>(() => normalizedSoloRole(draft?.soloRole, draft?.mode ?? DEFAULT_MODE))
  const [roles, setRoles] = useState<string[]>(() => draft?.solo === true
    ? []
    : (draft?.roles ?? initialFactionRoles ?? [...(TEMPLATES[0]?.roles ?? [])]))
  // 阵容：把角色和皮肤绑定到一起；单人时为空，切回团队时按当前模式恢复。
  const [faction, setFaction] = useState<string | undefined>(draft?.solo === true ? undefined : initialFaction)
  const [superFast, setSuperFast] = useState(() => draft?.superFast ?? false)
  const [submitting, setSubmitting] = useState(() => draft?.submitting ?? false)
  const [submittedAt, setSubmittedAt] = useState(() => draft?.submittedAt ?? 0)
  // 视觉爆炸 is an optional emphasis inside the 开发模式 block, OFF by default:
  // an unselected ambition injects nothing into the constitution or prompts.
  const [visualEnabled, setVisualEnabled] = useState(() => draft?.ambition === 'visual')
  const ambition = visualEnabled ? 'visual' : undefined
  // 复刻项目: URL / GitHub repo / local path. Analysis is automatic in the
  // 需求 step; an empty value is simply ignored.
  const [referenceInput, setReferenceInput] = useState(() => draft?.referenceInput ?? '')
  const [referenceProfile, setReferenceProfile] = useState<ReferenceProfileView | undefined>(() => draft?.referenceProfile)
  const [referenceSelection, setReferenceSelection] = useState<ReferenceSelection>(() => draft?.referenceSelection ?? selectionOf(draft?.referenceProfile?.inferred))
  const [referenceState, setReferenceState] = useState<'idle' | 'analyzing' | 'ready' | 'error'>(() => draft?.referenceProfile === undefined ? 'idle' : 'ready')
  const [referenceError, setReferenceError] = useState('')
  // 目标附件: images/videos dropped into the goal input (uploaded on drop).
  const [attachments, setAttachments] = useState<GoalAttachment[]>(() => draft?.attachments ?? [])
  const [uploading, setUploading] = useState(0)
  const [attachmentError, setAttachmentError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [rememberedHint, setRememberedHint] = useState(false)
  const bagLoaded = useRef(false)

  const steps: readonly Step[] = STEPS
  const submitActive = useRef(false)

  useEffect(() => {
    if (step > steps.length - 1) setStep(steps.length - 1)
  }, [step, steps.length])
  const [developerMode] = useState<boolean>(() => {
    try { return window.localStorage.getItem('dsh-super-agent.dev') === '1' } catch { return false }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [created, setCreated] = useState<string | undefined>()
  // Module 0: AI polish writes straight back into the goal textarea.
  const [polishBusy, setPolishBusy] = useState(false)
  const [polishError, setPolishError] = useState('')
  // Module 1: the model generates its own questions from this requirement.
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestionView[]>(() => draft?.questions ?? [])
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string[]>>(() => draft?.answers ?? {})
  const [interviewState, setInterviewState] = useState<'loading' | 'ready' | 'fallback'>(() => draft?.questions?.length ? 'ready' : 'loading')
  const [interviewError, setInterviewError] = useState('')
  const [interviewNonce, setInterviewNonce] = useState(0)
  const goalRef = useRef<HTMLTextAreaElement | null>(null)
  const sessionRef = useRef(sessionId)
  const hydratingDraft = useRef(false)
  const foundedTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    if (foundedTimer.current !== undefined) window.clearTimeout(foundedTimer.current)
  }, [])

  useEffect(() => {
    if (sessionRef.current === sessionId) return
    sessionRef.current = sessionId
    hydratingDraft.current = true
    // A request belongs to the session that started it; switching conversations
    // must not carry its spinner/error into the new one.
    setBusy(false)
    setError('')
    setCreated(undefined)
    setPolishBusy(false)
    setPolishError('')
    submitActive.current = false
    const next = readQuickStartDraft(sessionId)
    setStep(next?.step ?? 0)
    setMode(next?.mode ?? DEFAULT_MODE)
    setGoal(next?.goal ?? '')
    setTemplate('ship')
    setSolo(next?.solo ?? false)
    setSoloRole(normalizedSoloRole(next?.soloRole, next?.mode ?? DEFAULT_MODE))
    setFaction(next?.solo === true ? undefined : next?.faction)
    setRoles(next?.solo === true ? [] : (next?.roles ?? [...(TEMPLATES[0]?.roles ?? [])]))
    setSuperFast(next?.superFast ?? false)
    setSubmitting(next?.submitting ?? false)
    setSubmittedAt(next?.submittedAt ?? 0)
    setInterviewQuestions(next?.questions ?? [])
    setInterviewAnswers(next?.answers ?? {})
    setInterviewState(next?.questions?.length ? 'ready' : 'loading')
    setVisualEnabled(next?.ambition === 'visual')
    setReferenceInput(next?.referenceInput ?? '')
    setReferenceProfile(next?.referenceProfile)
    setReferenceSelection(next?.referenceSelection ?? selectionOf(next?.referenceProfile?.inferred))
    setReferenceState(next?.referenceProfile === undefined ? 'idle' : 'ready')
    setReferenceError('')
    setAttachments(next?.attachments ?? [])
    setUploading(0)
    setAttachmentError('')
    setDragActive(false)
    setRememberedHint(false)
  }, [sessionId])

  // 三界行囊: a fresh session opens with the last founding choices. A per-session
  // draft always wins (the user already started editing this one).
  useEffect(() => {
    if (bagLoaded.current) return
    bagLoaded.current = true
    if (draft !== undefined) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch('/plugins/dsh-super-agent/founding/bag?sessionId=' + encodeURIComponent(sessionId), { cache: 'no-store', signal: controller.signal })
        const body = await response.json().catch(() => null) as { ok?: boolean; bag?: unknown } | null
        if (!response.ok || body?.ok !== true) return
        const bag: FoundingBagView | undefined = asFoundingBag(body.bag)
        if (bag === undefined) return
        if (isTeamMode(bag.mode)) setMode(primaryModeOf(bag.mode))
        setVisualEnabled(bag.ambition === 'visual')
        if (bag.reference?.input !== undefined) {
          setReferenceInput(bag.reference.input)
          if (bag.reference.profile !== undefined) {
            setReferenceProfile(bag.reference.profile)
            setReferenceSelection(selectionOf(layeredDefaults(bag)))
            setReferenceState('ready')
          }
        }
        setRememberedHint(true)
      } catch { /* the bag is optional; founding still works */ }
    })()
    return () => controller.abort()
  }, [sessionId])

  // 同一会话的草稿跨切换保留：访谈问题、答案、当前步骤都不重新生成。
  useEffect(() => {
    if (sessionRef.current !== sessionId) return
    if (hydratingDraft.current) { hydratingDraft.current = false; return }
    saveQuickStartDraft(sessionId, {
      step, mode, goal, template, ambition: visualEnabled ? 'visual' : '', roles, faction, projectKind, solo, soloRole, superFast,
      questions: interviewQuestions, answers: interviewAnswers,
      referenceInput, attachments, ...referenceProfile === undefined ? {} : { referenceProfile }, referenceSelection,
      submitting, submittedAt,
    })
  }, [sessionId, step, mode, goal, template, visualEnabled, roles, faction, projectKind, solo, soloRole, superFast, interviewQuestions, interviewAnswers, referenceInput, attachments, referenceProfile, referenceSelection, submitting, submittedAt])

  // If the wizard unmounts while 立誓 is in flight (window/session switch), the
  // request may finish without its React callback. Recover the new staged team
  // from the host snapshot instead of leaving the oath screen stuck.
  useEffect(() => {
    if (!submitting || submittedAt === 0) return
    // The owning request is still running in this component; its catch/finally
    // will report the real result. Only an orphaned submit (remount) recovers.
    if (submitActive.current) return
    let alive = true
    let timer: number | undefined
    const started = Date.now()
    setBusy(true)
    const poll = async (): Promise<void> => {
      if (!alive) return
      try {
        const response = await fetch('/plugins/dsh-super-agent/state', { cache: 'no-store' })
        const body = await response.json() as { teams?: Array<{ teamId?: string; teamName?: string; name?: string; captainSessionId?: string; phase?: string; createdAt?: number }> }
        const found = (body.teams ?? []).find(team => team.captainSessionId === sessionId
          && team.phase === 'staged'
          && (team.createdAt ?? 0) >= submittedAt - 5_000)
        if (found?.teamId !== undefined) {
          alive = false
          if (timer !== undefined) window.clearInterval(timer)
          setSubmitting(false)
          setSubmittedAt(0)
          clearQuickStartDraft(sessionId)
          setBusy(false)
          setCreated(t('quickstart.created', {
            team: found.teamName ?? found.name ?? found.teamId,
            sect: crewName,
          }))
          window.dispatchEvent(new CustomEvent(TEAM_CREATED_EVENT, { detail: { teamId: found.teamId, sessionId } }))
          onFounded?.()
          return
        }
      } catch { /* keep polling */ }
      if (Date.now() - started > 180_000) {
        alive = false
        if (timer !== undefined) window.clearInterval(timer)
        setSubmitting(false)
        setSubmittedAt(0)
        setBusy(false)
        setError(t('quickstart.generationLost'))
      }
    }
    void poll()
    timer = window.setInterval(() => { void poll() }, 1_500)
    return () => { alive = false; if (timer !== undefined) window.clearInterval(timer) }
  }, [submitting, submittedAt, sessionId])



  const close = (): void => {
    if (busy) return
    onDone?.()
  }
  const activeLineup = lineupById(faction)
  const selectFaction = (id: string): void => {
    const def = lineupById(id)
    if (def === undefined) return
    setFaction(id)
    setRoles([...new Set(def.entries.map(entry => entry.role))])
  }
  // 选模式即选阵容：滚动条切模式后同步切到该模式的阵容预设。
  const chooseMode = (next: TeamMode): void => {
    setMode(next)
    setSuperFast(false)
    setInterviewQuestions([])
    setInterviewAnswers({})
    setInterviewState('loading')
    if (solo) {
      // 单人角色必须留在新模式的阵容里；不在时回退到首选角色。
      setSoloRole(current => {
        const candidates = soloCandidatesFor(next)
        return candidates.includes(current) ? current : preferredSoloRole(candidates)
      })
      return
    }
    const preset = modeLineupFor(next) ?? visibleFactions[0]?.id
    if (preset !== undefined) selectFaction(preset)
  }
  // 单人 / 团队：团队恢复当前模式的阵容，单人清空成员交给师父执行。
  const chooseCrew = (nextSolo: boolean): void => {
    if (nextSolo === solo) return
    setSolo(nextSolo)
    if (nextSolo) {
      setFaction(undefined)
      setRoles([])
      const candidates = soloCandidatesFor(mode)
      setSoloRole(current => candidates.includes(current) ? current : preferredSoloRole(candidates))
      return
    }
    const preset = modeLineupFor(mode) ?? visibleFactions[0]?.id
    if (preset !== undefined) selectFaction(preset)
  }
  const roleName = (id: string): string => {
    const entry = activeLineup?.entries.find(item => item.role === id)
    if (entry !== undefined) return skinLookup.get(entry.skin)?.name ?? entry.skin
    return roleDef(id)?.name ?? id
  }
  /** 一枚行者 chip：优先用像素人立绘，找不到对应法门时退回首字徽记。 */
  const personChip = (role: string) => {
    const label = customRoles.find(entry => entry.role === role)?.name ?? roleName(role)
    const art = memberArtUrl(label, role)
    return (
      <span key={role} className={css.chip} title={role}>
        {art === null
          ? <span className={css.chipLetter} aria-hidden>{label.slice(0, 1)}</span>
          : <img className={css.chipAvatar} src={art} alt="" />}
        {label}
      </span>
    )
  }

  const goalTrimmed = goal.trim()
  const runPolish = async (): Promise<void> => {
    if (goalTrimmed === '') { setPolishError(t('quickstart.goalRequired')); return }
    setPolishBusy(true)
    setPolishError('')
    try {
      const response = await fetch('/plugins/dsh-super-agent/polish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, requirement: goalTrimmed, mode }),
      })
      const body = await response.json().catch(() => null) as {
        ok?: boolean; expanded?: string; degraded?: boolean; error?: string
      } | null
      if (!response.ok || body?.ok !== true) throw new Error(body?.error ?? ('HTTP ' + response.status))
      // Insert the polished text into the input; the user decides the next step.
      const expanded = (body.expanded ?? goalTrimmed).trim()
      setGoal(expanded)
      if (body.degraded === true) {
        setPolishError(t('polish.degradedDetail', { error: body.error ?? t('polish.degraded') }))
      } else if (expanded === goalTrimmed) {
        setPolishError(t('polish.unchanged'))
      }
    } catch (cause) {
      setPolishError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPolishBusy(false)
    }
  }

  /** Upload dropped images/videos; each one lands under .pixel-team/uploads. */
  const uploadGoalFiles = async (files: readonly File[]): Promise<void> => {
    for (const file of files) {
      if (!(file.type.startsWith('image/') || file.type.startsWith('video/'))) {
        setAttachmentError(t('quickstart.attachmentType'))
        continue
      }
      if (file.size > 25 * 1024 * 1024) {
        setAttachmentError(t('quickstart.attachmentTooLarge'))
        continue
      }
      setUploading((count) => count + 1)
      setAttachmentError('')
      try {
        const data = await fileToBase64(file)
        const response = await fetch('/plugins/dsh-super-agent/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, name: file.name, mime: file.type, data }),
        })
        const body = await response.json().catch(() => null) as { ok?: boolean; attachment?: GoalAttachment; error?: string } | null
        if (!response.ok || body?.ok !== true || body.attachment === undefined) {
          throw new Error(body?.error ?? ('HTTP ' + response.status))
        }
        setAttachments((current) => current.some(item => item.path === body.attachment!.path) ? current : [...current, body.attachment!])
      } catch (cause) {
        setAttachmentError(t('quickstart.attachmentFailed', { message: cause instanceof Error ? cause.message : String(cause) }))
      } finally {
        setUploading((count) => Math.max(0, count - 1))
      }
    }
  }

  // 复刻项目: the host opens its native directory chooser. Analysis is
  // automatic in the 需求 step — entering a value is the only trigger.
  const chooseReferenceFolder = async (): Promise<void> => {
    try {
      const picked = await pickDirectoryPath()
      if (picked === null || picked.trim() === '') return
      setReferenceInput(picked)
      setReferenceProfile(undefined)
      setReferenceSelection(selectionOf(undefined))
      setReferenceState('idle')
      setReferenceError('')
      // A new value must re-run the 需求 request that carries it.
      setInterviewQuestions([])
      setInterviewAnswers({})
      setInterviewState('loading')
    } catch (cause) {
      setReferenceError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  // Ask the model for template-like questions when the interview step opens.
  useEffect(() => {
    if (steps[step] !== 'board' || goalTrimmed === '' || interviewQuestions.length > 0) return
    // 超级快速：跳过 AI 访谈，直接拍板。
    if (superFast) return
    const controller = new AbortController()
    setInterviewState('loading')
    setInterviewError('')
    setInterviewQuestions([])
    // A non-empty 复刻项目 is the only trigger: show its automatic parse state.
    if (referenceInput.trim() !== '') setReferenceState('analyzing')
    void (async () => {
      try {
        const response = await fetch('/plugins/dsh-super-agent/interview/questions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // The host analyzes the reference for this request (cached in the
          // bag), so the questions and the inferred defaults share one profile.
          body: JSON.stringify({
            sessionId,
            mode,
            requirement: goalTrimmed,
            ambition,
            ...referenceInput.trim() === '' ? {} : { reference: referenceInput.trim() },
          }),
          signal: controller.signal,
        })
        const body = await response.json().catch(() => null) as {
          ok?: boolean
          questions?: InterviewQuestionView[]
          reference?: unknown
          referenceDefaults?: unknown
          referenceWarning?: string
          error?: string
        } | null
        if (!response.ok || body?.ok !== true || !Array.isArray(body.questions)) {
          throw new Error(body?.error ?? ('HTTP ' + response.status))
        }
        setInterviewQuestions(body.questions)
        setInterviewAnswers({})
        setInterviewState('ready')
        // The 需求 response carries the profile; its inferred defaults feed the
        // clarification automatically (no confirmation panel any more).
        const interviewProfile = asReferenceProfile(body.reference)
        if (interviewProfile !== undefined && referenceProfile === undefined) {
          setReferenceProfile(interviewProfile)
          setReferenceSelection(selectionOf(asReferenceDefaults(body.referenceDefaults) ?? interviewProfile.inferred))
          setReferenceState('ready')
          setReferenceError('')
        }
        if (body.referenceWarning !== undefined && body.referenceWarning !== '') {
          setReferenceState('error')
          setReferenceError(body.referenceWarning)
        } else if (referenceInput.trim() !== '' && interviewProfile === undefined) {
          setReferenceState('idle')
        }
      } catch (cause) {
        if (controller.signal.aborted) return
        setInterviewError(cause instanceof Error ? cause.message : String(cause))
        setInterviewQuestions(fallbackInterviewQuestions(mode))
        setInterviewState('fallback')
      }
    })()
    return () => { controller.abort() }
  }, [step, goalTrimmed, sessionId, mode, ambition, interviewNonce, superFast])
  const currentStep: Step = steps[step] ?? steps[0] as Step
  const canAdvance = useMemo(() => {
    // Never advance while polish is still running: the result is about to land
    // in the goal textarea.
    if (busy || polishBusy) return false
    switch (currentStep) {
      case 'vow': return goalTrimmed.length >= 2
      // 拍板步不再被访谈阻塞：问题没回来也能直接提交，用模式默认值兜底。
      case 'board': return true
      default: return true
    }
  }, [busy, polishBusy, currentStep, goalTrimmed])

  const submit = async (replace: boolean): Promise<void> => {
    if (goalTrimmed === '') { setError(t('quickstart.goalRequired')); setStep(0); return }
    if (sessionId === undefined) { setError(t('quickstart.sessionMissing')); return }
    setBusy(true)
    setError('')
    submitActive.current = true
    const startedAt = Date.now()
    const requestController = new AbortController()
    const requestTimer = window.setTimeout(() => { requestController.abort() }, 90_000)
    const requestSession = sessionId
    setSubmitting(true)
    setSubmittedAt(startedAt)
    saveQuickStartDraft(sessionId, {
      step, mode, goal, template, ambition: visualEnabled ? 'visual' : '', roles, faction, projectKind, solo, soloRole, superFast,
      questions: interviewQuestions, answers: interviewAnswers,
      referenceInput, attachments, ...referenceProfile === undefined ? {} : { referenceProfile }, referenceSelection,
      submitting: true, submittedAt: startedAt,
    })
    try {
      // Build the clarification deterministically from the mode baseline + the
      // interview answers, so founding needs only ONE model round (plan
      // generation) instead of two and the wait is shorter.
      const interviewNotes = interviewQuestions
        .map(question => ({ question: question.prompt, answer: interviewAnswers[question.id] ?? [] }))
        .filter(item => item.answer.length > 0)
        .map(item => item.question + '：' + item.answer.join(' / '))
      const base = fallbackClarification(mode)
      const baselineAcceptance = Array.isArray(base.acceptance) ? base.acceptance as string[] : []
      // Only the user's own checks extend the baseline: never invent criteria.
      const acceptanceAnswers = [...new Set(interviewQuestions
        .filter(question => question.id === 'acceptance' || question.prompt.includes('验收'))
        .flatMap(question => interviewAnswers[question.id] ?? []))]
      const platformAnswers = [...new Set(interviewQuestions
        .filter(question => question.id === 'platform' || question.prompt.includes('平台'))
        .flatMap(question => interviewAnswers[question.id] ?? []))]
      const projectKindNote = '项目类型：工程任务'
      // 法脉/宏愿/参考项目 ride into the durable clarification; the reference's
      // inferred defaults are merged beneath the user's own interview choices.
      const clarification = mergeClarification({
        base: { ...base, ...faction === undefined || solo ? {} : { faction }, acceptance: [...new Set([...baselineAcceptance, ...acceptanceAnswers])] },
        doctrine: template,
        ambition,
        referenceInput: referenceInput.trim(),
        ...referenceProfile === undefined ? {} : { profile: referenceProfile },
        ...referenceProfile === undefined ? {} : { selection: referenceSelection },
        interviewNotes,
        platformAnswers,
        projectKindNote,
      })
      type QuickStartResponse = { ok?: boolean; existing?: boolean; teamId?: string; teamName?: string; team?: import('./activity-monitor.ts').ActivityTeam; error?: string }
      const fullBody = {
        sessionId,
        mode,
        goal: goalTrimmed,
        template,
        ambition,
        doctrine: template,
        // 单人不是“无成员”：只创建一个行者，由它执行全部任务。
        roles: solo ? [soloRole] : roles,
        ...(() => {
          const lineupNames = Object.fromEntries((activeLineup?.entries ?? []).map(entry => [entry.role, skinLookup.get(entry.skin)?.name ?? entry.skin]))
          const customNames = Object.fromEntries(customRoles.filter(entry => (solo ? [soloRole] : roles).includes(entry.role)).map(entry => [entry.role, entry.name]))
          const names = { ...lineupNames, ...customNames, ...solo ? { [soloRole]: soloRoleLabel } : {} }
          return Object.keys(names).length === 0 ? {} : { roleNames: names }
        })(),
        teamName: solo ? soloRoleLabel + ' · 单人' : activeLineup?.name,
        ...(solo
          ? {
            roleAgents: { [soloRole]: agents[soloRole] ?? roleDef(soloRole)?.agent ?? 'dsh' },
            roleExecutors: { [soloRole]: roleDef(soloRole)?.executor ?? 'implementer' },
          }
          : activeLineup === undefined ? {} : {
            roleAgents: Object.fromEntries([...new Set(activeLineup.entries.map(entry => entry.role))].map(role => [role, agents[role] ?? roleDef(role)?.agent ?? 'dsh'])),
            roleExecutors: Object.fromEntries([...new Set(activeLineup.entries.map(entry => entry.role))].map(role => [role, roleDef(role)?.executor ?? 'implementer'])),
          }),
        ...(() => {
          // Only user overrides travel: the host re-attaches each expert prompt
          // body from its own catalog, so the browser never ships ~1 MB of them.
          // Only non-catalog prompts travel: the host re-attaches each built-in
          // expert body from its own catalog, while user overrides and the
          // prompts of user-created roles (which exist only in this browser) are
          // still sent verbatim.
          const selected = solo ? [soloRole] : [...new Set(roles)]
          const customPrompt = (role: string): string | undefined => customAgencyRoles.find(entry => entry.id === role)?.prompt
          const overrides = Object.fromEntries(selected
            .map(role => [role, rolePrompts[role] ?? customPrompt(role) ?? ''] as const)
            .filter(([, prompt]) => prompt !== ''))
          return Object.keys(overrides).length === 0 ? {} : { rolePrompts: overrides }
        })(),
        ...faction === undefined || solo ? {} : { faction },
        // 单人也走真实的单成员编制（solo=true 会被服务端改成“师父全包”）。
        solo: false,
        projectKind,
        replace: replace || existingTeam === true,
        fast: superFast,
        clarification,
        requirement: {
          original: goalTrimmed,
          expanded: '',
          conditions: [],
          ...attachments.length === 0 ? {} : { attachments },
        },
        // 复刻项目: a non-empty value is the trigger; empty is ignored.
        ...referenceInput.trim() === '' ? {} : { reference: referenceInput.trim() },
      }
      let response = await fetch('/plugins/dsh-super-agent/quick-start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fullBody),
        signal: requestController.signal,
      })
      let text = await response.text()
      let body: QuickStartResponse | null = null
      try { body = text === '' ? null : JSON.parse(text) as QuickStartResponse } catch { body = null }
      if (sessionRef.current !== requestSession) return
      // Some hosts reject the full clarification body with an empty 400. Retry
      // with a minimal founding request that the server fills with defaults.
      if (response.status === 400 && !requestController.signal.aborted) {
        response = await fetch('/plugins/dsh-super-agent/quick-start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, mode, goal: goalTrimmed, template: 'ship', roles: solo ? [soloRole] : roles, solo: false, replace: true, fast: true, minimal: true }),
          signal: requestController.signal,
        })
        text = await response.text()
        try { body = text === '' ? null : JSON.parse(text) as QuickStartResponse } catch { body = null }
      }
      if (body?.existing === true && body.teamId !== undefined) {
        setSubmitting(false)
        setSubmittedAt(0)
        clearQuickStartDraft(sessionId)
        setCreated(t('quickstart.created', {
          team: body.teamName ?? body.teamId,
          sect: crewName,
        }))
        window.dispatchEvent(new CustomEvent(TEAM_CREATED_EVENT, { detail: { teamId: body.teamId, sessionId, team: body.team } }))
        setGoal('')
        foundedTimer.current = window.setTimeout(() => { onFounded?.() }, 300)
        return
      }
      if (!response.ok || body?.ok !== true) {
        const raw = body?.error ?? ('HTTP ' + response.status + (text.trim() === '' ? '' : ': ' + text.trim().slice(0, 200)))
        throw new Error(raw)
      }
      setCreated(t('quickstart.created', {
        team: body.teamName ?? body.teamId ?? '',
        sect: crewName,
      }))
      if (body.teamId !== undefined) window.dispatchEvent(new CustomEvent(TEAM_CREATED_EVENT, { detail: { teamId: body.teamId, sessionId, team: body.team } }))
      setSubmitting(false)
      setSubmittedAt(0)
      clearQuickStartDraft(sessionId)
      setGoal('')
      foundedTimer.current = window.setTimeout(() => { onFounded?.() }, 300)
    } catch (cause) {
      if (sessionRef.current !== requestSession) return
      // The server can create the staged team and still lose/abort the response.
      // Recover it by creation time before reporting a failure.
      const found = await findRecentStagedTeam(sessionId, startedAt, requestController.signal)
      if (found !== undefined) {
        setSubmitting(false)
        setSubmittedAt(0)
        clearQuickStartDraft(sessionId)
        setCreated(t('quickstart.created', {
          team: found.name,
          sect: crewName,
        }))
        window.dispatchEvent(new CustomEvent(TEAM_CREATED_EVENT, { detail: { teamId: found.teamId, sessionId } }))
        setGoal('')
        foundedTimer.current = window.setTimeout(() => { onFounded?.() }, 300)
        return
      }
      setSubmitting(false)
      setSubmittedAt(0)
      const aborted = cause instanceof Error && cause.name === 'AbortError'
      setError(aborted ? t('quickstart.timeout') : cause instanceof Error ? cause.message : String(cause))
    } finally {
      window.clearTimeout(requestTimer)
      if (sessionRef.current === requestSession) {
        submitActive.current = false
        setBusy(false)
      }
    }
  }

  const goTo = (next: number): void => {
    if (busy) return
    setError('')
    setStep(Math.max(0, Math.min(steps.length - 1, next)))
  }
  const next = (): void => {
    if (step === steps.length - 1) { void submit(false); return }
    if (!canAdvance) return
    // 超级快速跳过 AI 访谈，直接进入拍板。
    if (currentStep === 'vow' && superFast) { goTo(steps.length - 1); return }
    goTo(step + 1)
  }
  const modeSpec = getModeSpec(mode)
  const modeIndex = Math.max(0, (PRIMARY_MODES as readonly TeamMode[]).indexOf(mode))
  const modeFitKey = ('mode.fit.' + mode) as Parameters<typeof t>[0]
  const roster = solo ? [] : roles
  const soloCandidates = soloCandidatesFor(mode)
  const soloRoleLabel = customRoles.find(entry => entry.role === soloRole)?.name ?? roleName(soloRole)
  const soloRoster = solo ? [soloRole] : []
  const crewName = solo
    ? t('quickstart.crewSoloName') + ' · ' + soloRoleLabel
    : (activeLineup?.name ?? modeSpec.name)

  return (
    <div className={css.wizard}>
      <div className={css.form}>
          <ol className={css.steps} aria-label={t('quickstart.title')}>
            {steps.map((entry, index) => {
              const state = index === step ? 'current' : index < step ? 'done' : 'todo'
              return (
                <li key={entry} className={css.stepItem} data-state={state}>
                  <button
                    type="button"
                    className={css.stepButton}
                    data-control={'quickstart-step-' + index}
                    aria-current={state === 'current' ? 'step' : undefined}
                    disabled={busy || polishBusy || index > step}
                    onClick={() => { goTo(index) }}
                  >
                    <span className={css.stepDot}>{index < step ? '✓' : index + 1}</span>
                    <span className={css.stepLabel}>{t(STEP_LABEL[entry])}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          {currentStep === 'vow' && (
            <section className={css.stepPane} data-step="vow">
              {/* 一行工具条：单师父 / AI 润色 / 超级快速，替掉原来的三行按钮区。 */}
              <div className={css.vowTools}>
                <button
                  type="button"
                  className={css.polishButton}
                  disabled={busy || polishBusy || goalTrimmed === ''}
                  onClick={() => { void runPolish() }}
                >
                  {polishBusy ? t('polish.busy') : t('polish.button')}
                </button>
                <button
                  type="button"
                  className={css.modeChip}
                  data-active={superFast || undefined}
                  disabled={busy}
                  title={t('quickstart.superFastHint')}
                  onClick={() => { setSuperFast((current) => !current); setInterviewQuestions([]); setInterviewAnswers({}); setInterviewState('loading') }}
                >
                  ⚡ {t('quickstart.superFast')}
                </button>
              </div>
              {polishError !== '' && <span className={css.polishError} role="alert">{polishError}</span>}
              <div
                className={css.field}
                data-dragging={dragActive || undefined}
                onDragOver={(event) => { event.preventDefault(); if (!busy) setDragActive(true) }}
                onDragLeave={() => { setDragActive(false) }}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragActive(false)
                  if (!busy) void uploadGoalFiles([...event.dataTransfer.files])
                }}
              >
                <span>{t('quickstart.goal')}</span>
                <textarea
                  ref={goalRef}
                  value={goal}
                  rows={3}
                  autoFocus
                  disabled={busy || polishBusy}
                  placeholder={t('quickstart.goalPlaceholder')}
                  onChange={(event) => { setGoal(event.target.value); setPolishError(''); setInterviewQuestions([]); setInterviewAnswers({}); setInterviewState('loading') }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); next() }
                  }}
                />
                <div className={css.attachmentRow}>
                  <label className={css.attachButton}>
                    {uploading > 0 ? t('quickstart.uploading') : t('quickstart.attach')}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      hidden
                      disabled={busy}
                      onChange={(event) => {
                        void uploadGoalFiles([...(event.target.files ?? [])])
                        event.target.value = ''
                      }}
                    />
                  </label>
                  <small className={css.attachHint}>{t('quickstart.dropHint')}</small>
                </div>
                {attachments.length > 0 && (
                  <div className={css.attachmentChips}>
                    {attachments.map(item => (
                      <span key={item.path} className={css.attachmentChip} title={item.path}>
                        {item.kind === 'image' ? '🖼️' : '🎬'} {item.name}
                        <button
                          type="button"
                          aria-label={t('quickstart.removeAttachment')}
                          onClick={() => { setAttachments((current) => current.filter(entry => entry.path !== item.path)) }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
                {attachmentError !== '' && <span className={css.polishError} role="alert">{attachmentError}</span>}
              </div>
              <div className={css.crewBlock}>
                <div className={css.crewHead}>
                  <span className={css.modeLabel}>{t('quickstart.crewSlider')}</span>
                  <div className={css.crewToggle} role="radiogroup" aria-label={t('quickstart.crewSlider')}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!solo}
                      data-control="quickstart-crew-team"
                      data-active={!solo || undefined}
                      disabled={busy}
                      onClick={() => { chooseCrew(false) }}
                    >👥 {t('quickstart.crewTeam')}</button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={solo}
                      data-control="quickstart-crew-solo"
                      data-active={solo || undefined}
                      disabled={busy}
                      onClick={() => { chooseCrew(true) }}
                    >👤 {t('quickstart.crewSolo')}</button>
                  </div>
                </div>
                <input
                  className={css.modeSlider}
                  data-control="quickstart-mode-slider"
                  type="range"
                  min={0}
                  max={PRIMARY_MODES.length - 1}
                  step={1}
                  value={modeIndex}
                  disabled={busy}
                  aria-label={t('quickstart.crewSlider')}
                  aria-valuetext={t(modeSpec.labelKey as Parameters<typeof t>[0])}
                  onChange={(event) => {
                    const picked = PRIMARY_MODES[Number(event.target.value)]
                    if (picked !== undefined) chooseMode(picked)
                  }}
                />
                <div className={css.modeTicks}>
                  {PRIMARY_MODES.map(item => (
                    <button
                      key={item}
                      type="button"
                      className={css.modeTick}
                      data-active={mode === item || undefined}
                      disabled={busy}
                      onClick={() => { chooseMode(item) }}
                    >
                      <span aria-hidden>{getModeSpec(item).emoji}</span>
                      <span>{t(getModeSpec(item).labelKey as Parameters<typeof t>[0])}</span>
                    </button>
                  ))}
                </div>
                <div className={css.crewPreview}>
                  <div className={css.crewPreviewHead}>
                    <strong>{modeSpec.emoji} {t(modeSpec.labelKey as Parameters<typeof t>[0])}</strong>
                    <span className={css.crewCount}>
                      {solo ? soloRoleLabel : (activeLineup?.name ?? modeSpec.name) + ' · ' + roster.length + ' 人'}
                    </span>
                  </div>
                  <span className={css.crewLine}>{t(modeFitKey)}</span>
                  {solo ? (
                    <>
                      <span className={css.crewLine}>{t('quickstart.crewSoloHint')}</span>
                      <span className={css.soloRoles} role="radiogroup" aria-label={t('quickstart.soloRole')}>
                        {soloCandidates.map(role => (
                          <button
                            key={role}
                            type="button"
                            role="radio"
                            aria-checked={soloRole === role}
                            className={css.soloRoleChip}
                            data-control={'quickstart-solo-role-' + role}
                            data-active={soloRole === role || undefined}
                            disabled={busy}
                            onClick={() => { setSoloRole(role) }}
                          >
                            {roleName(role)}
                          </button>
                        ))}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={css.crewLine}>{t('quickstart.crewTeamHint')}</span>
                      <span className={css.chips}>{roster.map(personChip)}</span>
                    </>
                  )}
                </div>
                <div className={css.modeDivider} role="separator">
                  <span>{t('quickstart.visualSeparator')}</span>
                </div>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={visualEnabled}
                  className={css.visualToggle}
                  data-control="quickstart-visual"
                  data-active={visualEnabled || undefined}
                  disabled={busy}
                  title={t('quickstart.ambitionHint')}
                  onClick={() => { setVisualEnabled((current) => !current) }}
                >
                  <span className={css.modeName}>💥 {t('quickstart.ambitionLabel')}</span>
                  <span className={css.modeLine}>{t('quickstart.ambitionToggleHint')}</span>
                </button>
              </div>
              <div className={css.goalExtras}>
                <label className={css.field}>
                  <span>{t('quickstart.referenceTitle')}</span>
                  <div className={css.referencePickerRow}>
                    <input
                      className={css.referenceInput}
                      value={referenceInput}
                      disabled={busy || referenceState === 'analyzing'}
                      placeholder={t('quickstart.referencePlaceholder')}
                      onChange={(event) => {
                        setReferenceInput(event.target.value)
                        setReferenceProfile(undefined)
                        setReferenceSelection(selectionOf(undefined))
                        setReferenceState('idle')
                        setReferenceError('')
                        setInterviewQuestions([])
                        setInterviewAnswers({})
                        setInterviewState('loading')
                      }}
                    />
                    <button
                      type="button"
                      className={css.referenceButton}
                      data-control="quickstart-reference-pick"
                      disabled={busy || referenceState === 'analyzing'}
                      onClick={() => { void chooseReferenceFolder() }}
                    >
                      {t('quickstart.referencePick')}
                    </button>
                  </div>
                </label>
                <small className={css.templateDesc}>{t('quickstart.referenceAutoHint')}</small>
                {referenceError !== '' && <span className={css.polishError} role="alert">{referenceError}</span>}
                {rememberedHint && <small className={css.rememberedHint}>{t('quickstart.rememberedHint')}</small>}
              </div>
            </section>
          )}

          {currentStep === 'board' && (
            <section className={css.stepPane} data-step="board">
              <p className={css.hint}>{t('quickstart.boardHint')}</p>
              {referenceInput.trim() !== '' && (
                <div className={css.referencePanel} data-state={referenceState}>
                  <span className={css.referenceReady}>
                    {t('quickstart.referenceAutoTitle')}：{referenceProfile?.label ?? referenceInput.trim()}
                  </span>
                  <span className={css.referenceSub}>
                    {referenceState === 'analyzing'
                      ? t('quickstart.referenceAnalyzing')
                      : referenceProfile === undefined
                        ? t('quickstart.referenceAutoHint')
                        : t('quickstart.referenceAutoAnalyzed')}
                  </span>
                  {referenceError !== '' && <span className={css.polishError} role="alert">{referenceError}</span>}
                </div>
              )}
              {superFast ? (
                <p className={css.crewLine}>{t('quickstart.skipInterview')}</p>
              ) : (
                <InterviewSheet
                  questions={interviewQuestions}
                  answers={interviewAnswers}
                  onChange={setInterviewAnswers}
                  state={interviewState}
                  error={interviewError}
                  mode={mode}
                  disabled={busy}
                  onRetry={() => { setInterviewQuestions([]); setInterviewState('loading'); setInterviewNonce((value) => value + 1) }}
                  t={t}
                />
              )}
              <dl className={css.summary}>
                <div className={css.summaryRow}><dt>{t('mode.select')}</dt><dd>{modeSpec.emoji} {t(modeSpec.labelKey as Parameters<typeof t>[0])}</dd></div>
                <div className={css.summaryRow}><dt>{t('quickstart.summaryAmbition')}</dt><dd>{visualEnabled ? '💥 ' + t('quickstart.ambitionLabel') : t('quickstart.ambitionOff')}</dd></div>
                <div className={css.summaryRow}><dt>{t('quickstart.summaryCrew')}</dt><dd>{crewName}</dd></div>
                <div className={css.summaryRow}><dt>{t(solo ? 'quickstart.summarySoloRole' : 'quickstart.summaryRoster')}</dt><dd><span className={css.chips}>{(solo ? soloRoster : roster).map(personChip)}</span></dd></div>
                {referenceInput.trim() !== '' && (
                  <div className={css.summaryRow}><dt>{t('quickstart.summaryReference')}</dt><dd>{referenceProfile?.label ?? referenceInput.trim()}</dd></div>
                )}
                <div className={css.summaryRow}><dt>{t('quickstart.summaryVow')}</dt><dd>{goalTrimmed}</dd></div>
              </dl>
              <p className={css.hint}>{t('quickstart.oathNotice')}</p>
              {submitting && <p className={css.busyNote} role="status">{t('quickstart.generating')}</p>}
            </section>
          )}

          {error !== '' && <p className={css.error} role="alert">{error}</p>}
          {created !== undefined && <p className={css.success} role="status">{created}</p>}
      </div>
      <div className={css.wizardActions}>
        <button type="button" disabled={busy} onClick={close}>{t('quickstart.cancel')}</button>
        {step > 0 && (
          <button type="button" data-control="quickstart-back" disabled={busy} onClick={() => { goTo(step - 1) }}>{t('quickstart.back')}</button>
        )}
        {step < steps.length - 1 ? (
          <button type="button" data-primary data-control="quickstart-next" disabled={!canAdvance} onClick={next}>
            {t('quickstart.next')}
          </button>
        ) : (
          <button type="button" data-primary data-control="quickstart-submit" disabled={busy || !canAdvance} onClick={() => { void submit(existingTeam === true) }}>
            {busy ? t('quickstart.busy') : t('quickstart.boardSubmit')}
          </button>
        )}
      </div>
    </div>
  )
}

/** 对话头部的组队入口：统一打开福地里的内容气泡，不再弹独立窗口。 */
export function TeamQuickStart({ t }: PropsLocale<'agentTeams'>) {
  return (
    <button
      type="button"
      className={css.entry}
      data-quick-start-entry
      title={t('quickstart.entryTitle')}
      onClick={() => { window.dispatchEvent(new CustomEvent(OPEN_HALL_START_EVENT)) }}
    >
      <span aria-hidden>⛩</span>{t('quickstart.entry')}
    </button>
  )
}
