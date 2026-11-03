/** Click-to-dispatch entry: a header button that stages a plan from a small wizard. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import css from './QuickStartDialog.module.css'
import { memberArtUrl } from './artwork.ts'
import { roleLabel } from './role-catalog.ts'
import { useCustomRoles } from './custom-roles.ts'
import { useHiddenLineups } from './hidden-lineups.ts'
import { OPEN_HALL_START_EVENT } from './hall-events.ts'
import type { AgentTeamsTranslate } from './locales.ts'
import { TEAM_CREATED_EVENT } from './team-reveal.ts'
import { ROLE_META } from './role-labels.ts'
import { SECT_PRESETS, randomSect, sectPreset } from './sects.ts'
import { useLineups, lineupById } from './lineup-store.ts'
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

type GoalAttachment = { readonly name: string; readonly path: string; readonly mime: string; readonly kind: 'image' | 'video'; readonly size: number }

type QuickStartDraft = {
  step: number
  mode: TeamMode
  goal: string
  template: string
  /** 视觉爆炸 is fixed in the 目标 step; kept for draft compatibility. */
  ambition: string
  roles: string[]
  /** 阵营构造系统；未选时回退旧佛道势力预设。 */
  faction?: string
  sectMode: string
  rolledSect: string
  projectKind: 'engineering' | 'drama'
  solo: boolean
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
/** 阵营是全局偏好：新会话默认沿用上一次选择，而不是只记在当前草稿。 */
const LAST_FACTION_KEY = 'dsh-super-agent.lastFaction'

function readLastFaction(): string | undefined {
  try {
    const raw = window.localStorage.getItem(LAST_FACTION_KEY)
    return raw === null || raw.trim() === '' ? undefined : raw
  } catch { return undefined }
}

function writeLastFaction(id: string | undefined): void {
  try {
    if (id === undefined) window.localStorage.removeItem(LAST_FACTION_KEY)
    else window.localStorage.setItem(LAST_FACTION_KEY, id)
  } catch { /* private mode */ }
}

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
      sectMode: typeof value.sectMode === 'string' ? value.sectMode : 'random',
      rolledSect: typeof value.rolledSect === 'string' ? value.rolledSect : randomSect().id,
      // Legacy 'drama' drafts still load, but founding is engineering-only now.
      projectKind: 'engineering',
      solo: value.solo === true,
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
/** 组队步骤：目标（视觉爆炸 + 复刻项目） → 法脉 → 需求 → 取经队 → 立誓。 */
const STEPS = ['vow', 'doctrine', 'interview', 'sect', 'oath'] as const
const SOLO_STEPS = ['vow', 'doctrine', 'interview', 'oath'] as const
type Step = typeof STEPS[number]
const STEP_LABEL: Record<Step, 'quickstart.stepDoctrine' | 'quickstart.stepGoal' | 'quickstart.stepInterview' | 'quickstart.stepSect' | 'quickstart.stepOath'> = {
  doctrine: 'quickstart.stepDoctrine',
  vow: 'quickstart.stepGoal',
  interview: 'quickstart.stepInterview',
  sect: 'quickstart.stepSect',
  oath: 'quickstart.stepOath',
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

function templateOf(id: string): QuickTemplate {
  return TEMPLATES.find(entry => entry.id === id) ?? TEMPLATES[0] as QuickTemplate
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
  const [template, setTemplate] = useState<string>(() => draft?.template ?? TEMPLATES[0]?.id ?? 'fix')
  // 新会话未带草稿时沿用全局上次阵营；有草稿时以草稿为准。
  const lastFaction = draft === undefined ? readLastFaction() : undefined
  const defaultFaction = lastFaction !== undefined && visibleFactions.some(lineup => lineup.id === lastFaction)
    ? lastFaction
    : visibleFactions[0]?.id
  const initialFaction: string | undefined = draft?.faction !== undefined && visibleFactions.some(lineup => lineup.id === draft.faction)
    ? draft.faction
    : draft === undefined ? defaultFaction : undefined
  const initialFactionRoles = initialFaction === undefined
    ? undefined
    : lineupById(initialFaction)?.entries.map(entry => entry.role)
  const [roles, setRoles] = useState<string[]>(() => draft?.roles ?? initialFactionRoles ?? [...(TEMPLATES[0]?.roles ?? [])])
  // 阵容：把角色和皮肤绑定到一起；选中后角色来自阵容条目。
  const [faction, setFaction] = useState<string | undefined>(initialFaction)
  // 佛道势力有两种玩法：用户选一个预设，或让系统随机动态分配（再点一次重抽）。
  const [sectMode, setSectMode] = useState<'random' | 'custom' | string>(() => draft?.sectMode ?? (initialFaction === undefined ? 'random' : 'custom'))
  const [rolledSect, setRolledSect] = useState<string>(() => draft?.rolledSect ?? randomSect().id)
  const [customRole, setCustomRole] = useState('')
  const [rolesOpen, setRolesOpen] = useState(false)
  // Solo run: no members are spawned; the captain executes every task itself.
  const [solo, setSolo] = useState(() => draft?.solo ?? false)
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

  const steps: readonly Step[] = solo ? SOLO_STEPS : STEPS
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
  const multiRef = useRef<HTMLDivElement | null>(null)
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
    setTemplate(next?.template ?? TEMPLATES[0]?.id ?? 'fix')
    setRoles(next?.roles ?? [...(TEMPLATES[0]?.roles ?? [])])
    setSectMode(next?.sectMode ?? 'random')
    setRolledSect(next?.rolledSect ?? randomSect().id)
    setSolo(next?.solo ?? false)
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
        if (typeof bag.doctrine === 'string' && TEMPLATES.some(entry => entry.id === bag.doctrine)) {
          setTemplate(bag.doctrine)
          if (sectMode === 'custom') setRoles([...templateOf(bag.doctrine).roles])
        }
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
      step, mode, goal, template, ambition: visualEnabled ? 'visual' : '', roles, faction, sectMode, rolledSect, projectKind, solo, superFast,
      questions: interviewQuestions, answers: interviewAnswers,
      referenceInput, attachments, ...referenceProfile === undefined ? {} : { referenceProfile }, referenceSelection,
      submitting, submittedAt,
    })
  }, [sessionId, step, mode, goal, template, visualEnabled, roles, faction, sectMode, rolledSect, projectKind, solo, superFast, interviewQuestions, interviewAnswers, referenceInput, attachments, referenceProfile, referenceSelection, submitting, submittedAt])

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
            sect: activeSect === undefined ? t('quickstart.sectCustomPicked') : t(activeSect.nameKey),
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


  useEffect(() => {
    if (!rolesOpen) return
    const onPointerDown = (event: PointerEvent): void => {
      if (multiRef.current === null) return
      if (!multiRef.current.contains(event.target as Node)) setRolesOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown) }
  }, [rolesOpen])

  const close = (): void => {
    if (busy) return
    onDone?.()
  }
  const activeSect = sectMode === 'custom' ? undefined : sectPreset(sectMode === 'random' ? rolledSect : sectMode)
  const sectRoles = activeSect?.roles ?? roles
  const chooseTemplate = (id: string): void => {
    setTemplate(id)
    // 佛道势力已经配好法门时，换模板不再覆盖这套法门（自定义模式才跟随模板）；
    // 阵营成员表优先级更高，换模板不拆阵营。
    if (sectMode === 'custom' && faction === undefined) setRoles([...templateOf(id).roles])
  }
  const selectFaction = (id: string): void => {
    const def = lineupById(id)
    if (def === undefined) return
    setFaction(id)
    writeLastFaction(id)
    setSectMode('custom')
    setRoles([...new Set(def.entries.map(entry => entry.role))])
  }
  // 只剩 5 种法脉：短剧法脉暂时只在服务端保留，客户端不再展示（可回滚）。
  const visibleTemplates = TEMPLATES
  const chooseSect = (id: string): void => {
    setFaction(undefined)
    writeLastFaction(undefined)
    setSectMode(id)
    const preset = sectPreset(id)
    if (preset !== undefined) setRoles([...preset.roles])
  }
  const rollSect = (): void => {
    const next = randomSect(rolledSect)
    setFaction(undefined)
    writeLastFaction(undefined)
    setRolledSect(next.id)
    setSectMode('random')
    setRoles([...next.roles])
  }
  const chooseCustom = (): void => {
    setFaction(undefined)
    writeLastFaction(undefined)
    setSectMode('custom')
    if (roles.length === 0) setRoles([...templateOf(template).roles])
  }
  const toggleRole = (role: string): void => {
    setRoles((current) => current.includes(role) ? current.filter(entry => entry !== role) : [...current, role])
  }
  const roleName = (id: string): string => {
    const lineup = lineupById(faction)
    const entry = lineup?.entries.find(item => item.role === id)
    if (entry !== undefined) return skinLookup.get(entry.skin)?.name ?? entry.skin
    const role = roleDef(id)
    if (role !== undefined) return role.name
    const meta = ROLE_META.find(item => item.id === id)
    return meta === undefined ? id : t(meta.nameKey)
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
  const addCustomRole = (): void => {
    const trimmed = customRole.trim()
    if (trimmed === '') return
    setRoles((current) => current.includes(trimmed) ? current : [...current, trimmed])
    setCustomRole('')
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
    if (steps[step] !== 'interview' || goalTrimmed === '' || interviewQuestions.length > 0) return
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
  }, [step, goalTrimmed, sessionId, mode, ambition, interviewNonce])
  const currentStep: Step = steps[step] ?? steps[0] as Step
  const canAdvance = useMemo(() => {
    // Never advance while polish is still running: the result is about to land
    // in the goal textarea.
    if (busy || polishBusy) return false
    switch (currentStep) {
      case 'vow': return goalTrimmed.length >= 2
      case 'interview': return interviewState !== 'loading' && interviewQuestions.length > 0
      case 'sect': return solo || sectMode !== 'custom' || sectRoles.length > 0
      default: return true
    }
  }, [busy, polishBusy, currentStep, goalTrimmed, interviewState, interviewQuestions.length, sectMode, sectRoles.length, solo])

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
      step, mode, goal, template, ambition: visualEnabled ? 'visual' : '', roles, faction, sectMode, rolledSect, projectKind, solo, superFast,
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
        base: { ...base, ...faction === undefined ? {} : { faction }, acceptance: [...new Set([...baselineAcceptance, ...acceptanceAnswers])] },
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
        roles: solo ? [] : sectMode === 'custom' ? roles : [...(activeSect?.roles ?? roles)],
        ...(() => {
          const lineupNames = Object.fromEntries((activeLineup?.entries ?? []).map(entry => [entry.role, skinLookup.get(entry.skin)?.name ?? entry.skin]))
          const customNames = Object.fromEntries(customRoles.filter(entry => roles.includes(entry.role)).map(entry => [entry.role, entry.name]))
          const names = { ...lineupNames, ...customNames }
          return Object.keys(names).length === 0 ? {} : { roleNames: names }
        })(),
        ...activeLineup === undefined ? {} : { teamName: activeLineup.name },
        ...activeLineup === undefined ? {} : {
          roleAgents: Object.fromEntries([...new Set(activeLineup.entries.map(entry => entry.role))].map(role => [role, agents[role] ?? roleDef(role)?.agent ?? 'dsh'])),
          roleExecutors: Object.fromEntries([...new Set(activeLineup.entries.map(entry => entry.role))].map(role => [role, roleDef(role)?.executor ?? 'implementer'])),
        },
        ...(() => {
          // Only user overrides travel: the host re-attaches each expert prompt
          // body from its own catalog, so the browser never ships ~1 MB of them.
          // Only non-catalog prompts travel: the host re-attaches each built-in
          // expert body from its own catalog, while user overrides and the
          // prompts of user-created roles (which exist only in this browser) are
          // still sent verbatim.
          const selected = [...new Set([...roles, ...(activeLineup?.entries ?? []).map(entry => entry.role)])]
          const customPrompt = (role: string): string | undefined => customAgencyRoles.find(entry => entry.id === role)?.prompt
          const overrides = Object.fromEntries(selected
            .map(role => [role, rolePrompts[role] ?? customPrompt(role) ?? ''] as const)
            .filter(([, prompt]) => prompt !== ''))
          return Object.keys(overrides).length === 0 ? {} : { rolePrompts: overrides }
        })(),
        ...faction === undefined ? {} : { faction },
        solo,
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
          body: JSON.stringify({ sessionId, mode, goal: goalTrimmed, template: 'ship', solo, replace: true, fast: true, minimal: true }),
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
          sect: solo ? t('quickstart.soloSectName') : (activeSect === undefined ? t('quickstart.sectCustomPicked') : t(activeSect.nameKey)),
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
        sect: activeSect === undefined ? t('quickstart.sectCustomPicked') : t(activeSect.nameKey),
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
          sect: activeSect === undefined ? t('quickstart.sectCustomPicked') : t(activeSect.nameKey),
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
    // 超级快速跳过 AI 访谈；单师父模式由 active steps 直接跳到立誓。
    if (currentStep === 'vow' && superFast) { goTo(steps.indexOf('oath')); return }
    goTo(step + 1)
  }
  const doctrineDetail = templateOf(template)
  const doctrineName = t(doctrineDetail.labelKey)
  const activeLineup = lineupById(faction)
  const sectName = solo
    ? t('quickstart.soloSectName')
    : (activeLineup?.name ?? (activeSect === undefined ? t('quickstart.sectCustom') : t(activeSect.nameKey)))
  const rosterPool = sectMode === 'custom' ? roles : [...sectRoles]
  const templateRoles = new Set(templateOf(template).roles)
  const activeRoster = rosterPool.filter(role => templateRoles.has(role))
  // 摘要只展示计划实际会启用的角色；空集合时回退到用户选择。
  const roster = activeRoster.length > 0 ? activeRoster : rosterPool

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

          {currentStep === 'doctrine' && (
            <section className={css.stepPane} data-step="doctrine">
              <div className={css.templates} role="radiogroup" aria-label={t('quickstart.template')}>
                {visibleTemplates.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    role="radio"
                    aria-checked={template === entry.id}
                    className={css.templateCard}
                    data-control={'quickstart-template-' + entry.id}
                    disabled={busy}
                    onClick={() => { chooseTemplate(entry.id) }}
                  >
                    <span className={css.templateName}>{t(entry.labelKey)}</span>
                    <span className={css.templateDesc}>{t(entry.descKey as Parameters<typeof t>[0])}</span>
                    <span className={css.templateMeta}>{entry.roles.length} {t('quickstart.roleCount')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {currentStep === 'vow' && (
            <section className={css.stepPane} data-step="vow">
              {/* 一行工具条：单师父 / AI 润色 / 超级快速，替掉原来的三行按钮区。 */}
              <div className={css.vowTools}>
                <button
                  type="button"
                  className={css.soloButton}
                  data-active={solo || undefined}
                  disabled={busy}
                  title={solo ? t('quickstart.soloCleared') : t('quickstart.soloHint')}
                  onClick={() => {
                    const next = !solo
                    setSolo(next)
                    if (next) setRoles([])
                  }}
                >
                  {solo ? t('quickstart.soloActive') : t('quickstart.solo')}
                </button>
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
              <div className={css.modeBlock}>
                <span className={css.modeLabel}>{t('mode.select')}</span>
                <div className={css.modeCards} role="radiogroup" aria-label={t('mode.select')}>
                  {PRIMARY_MODES.map(item => {
                    const spec = getModeSpec(item)
                    const active = mode === item && !superFast
                    // 第三行「不会自动加」收进 title：信息源保留，屏幕上只留两行差异说明。
                    const neverAdded = t(('mode.never.' + item) as Parameters<typeof t>[0])
                    return (
                      <button
                        key={item}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={css.modeCard}
                        data-control={'quickstart-mode-' + item}
                        data-active={active || undefined}
                        disabled={busy}
                        title={t(('mode.desc.' + item) as Parameters<typeof t>[0]) + ' · ' + neverAdded}
                        onClick={() => { setMode(item); setSuperFast(false); setInterviewQuestions([]); setInterviewAnswers({}); setInterviewState('loading') }}
                      >
                        <span className={css.modeName}>{spec.emoji} {t(spec.labelKey as Parameters<typeof t>[0])}</span>
                        <span className={css.modeLine}>{t(('mode.fit.' + item) as Parameters<typeof t>[0])}</span>
                        <span className={css.modeLine}>{t(('mode.accept.' + item) as Parameters<typeof t>[0])}</span>
                      </button>
                    )
                  })}
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

          {currentStep === 'interview' && (
            <section className={css.stepPane} data-step="interview">
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
            </section>
          )}

          {currentStep === 'sect' && (
            <section className={css.stepPane} data-step="sect">
              <p className={css.hint}>{t('quickstart.sectHint')}</p>
              {!solo && (
                <div className={css.field}>
                  <span>阵营</span>
                  <div className={css.factionGrid} data-control="quickstart-factions">
                    {visibleFactions.map(def => (
                      <div key={def.id} className={css.factionItem} data-expanded={faction === def.id || undefined}>
                        <button
                          type="button"
                          className={css.factionCard}
                          data-active={faction === def.id || undefined}
                          disabled={busy}
                          onClick={() => { selectFaction(def.id) }}
                        >
                          <span className={css.factionTop}>
                            <strong>{def.name}</strong>
                            <em>阵容</em>
                          </span>
                          <span className={css.factionTagline}>{def.theme}</span>
                          <span className={css.factionMeta}>{def.entries.length} 个角色 · {new Set(def.entries.map(entry => entry.role)).size} 个职责</span>
                          <span className={css.factionRoster}>{def.entries.slice(0, 5).map(entry => skinLookup.get(entry.skin)?.name ?? entry.skin).join(' · ')}{def.entries.length > 5 ? ' …' : ''}</span>
                          <span className={css.factionPalette} aria-hidden>
                            <i style={{ background: skinLookup.get(def.entries[0]?.skin ?? '')?.background ?? '#333' }} />
                          </span>
                        </button>
                        {faction === def.id && (
                          <div className={css.lineupExpand}>
                            <div className={css.lineupExpandHead}>
                              <strong>{def.name}</strong>
                              <span>{def.theme}</span>
                            </div>
                            {def.entries.map(entry => {
                              const skin = skinLookup.get(entry.skin)
                              const role = roleDef(entry.role)
                              return (
                                <div key={entry.role + ':' + entry.skin} className={css.lineupExpandRow}>
                                  {skin !== undefined && <img src={skin.art} alt="" aria-hidden />}
                                  <span className={css.lineupExpandIdentity}>
                                    <strong>{skin?.name ?? entry.skin}</strong>
                                    <small>{role?.name ?? roleLabel(entry.role, t)}</small>
                                  </span>
                                  <span className={css.lineupExpandSkills}>{role?.skills.join(' · ') ?? ''}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <small className={css.templateDesc}>{t('quickstart.factionCostHint')}</small>
                </div>
              )}
              {solo ? (
                <p className={css.hint}>{t('quickstart.soloSectHidden')}</p>
              ) : faction !== undefined ? null : (
              <div className={css.field}>
                <span>{t('quickstart.sect')}</span>
                <div className={css.sectRow}>
                  <button type="button" className={css.sectChip} data-active={sectMode === 'random' || undefined} disabled={busy} onClick={rollSect}>
                    <span aria-hidden>🎲</span>{t('quickstart.sectRandom')}
                  </button>
                  {SECT_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      className={css.sectChip}
                      data-active={sectMode === preset.id || undefined}
                      disabled={busy}
                      onClick={() => { chooseSect(preset.id) }}
                    >
                      {t(preset.nameKey)}
                    </button>
                  ))}
                  <button type="button" className={css.sectChip} data-active={sectMode === 'custom' || undefined} disabled={busy} onClick={chooseCustom}>
                    {t('quickstart.sectCustom')}
                  </button>
                </div>
                <small className={css.templateDesc}>
                  {sectMode === 'custom'
                    ? t('quickstart.sectCustomHint')
                    : sectMode === 'random'
                      ? t('quickstart.sectRolled', { sect: activeSect === undefined ? '' : t(activeSect.nameKey) })
                      : activeSect === undefined ? '' : t(activeSect.descKey)}
                </small>
                {sectMode !== 'custom' && (
                  <span className={css.sectRoster}>
                    {sectRoles.map(personChip)}
                  </span>
                )}
              </div>
              )}
              {!solo && (
                <div className={css.field}>
                  <span>{t('quickstart.roles')}</span>
                  <div className={css.multi} ref={multiRef}>
                    <button
                      type="button"
                      className={css.multiTrigger}
                      data-control="quickstart-roles"
                      aria-expanded={rolesOpen}
                      aria-haspopup="listbox"
                      disabled={busy}
                      onClick={() => { setRolesOpen((current) => !current) }}
                    >
                      <span className={css.chips}>
                        {roles.length === 0
                          ? <span className={css.placeholder}>{t('quickstart.rolesEmpty')}</span>
                          : roles.map(personChip)}
                      </span>
                      <span className={css.caret} aria-hidden>▾</span>
                    </button>
                    {rolesOpen && (
                      <div className={css.multiPanel} role="listbox" aria-multiselectable="true" aria-label={t('quickstart.roles')}>
                        {ROLE_META.map(meta => (
                          <label key={meta.id} className={css.option}>
                            <input type="checkbox" checked={roles.includes(meta.id)} onChange={() => { toggleRole(meta.id) }} />
                            {(() => {
                              const art = memberArtUrl(t(meta.nameKey), meta.id)
                              return art === null ? null : <img className={css.optionAvatar} src={art} alt="" />
                            })()}
                            <span className={css.optionName}>{t(meta.nameKey)}</span>
                            <span className={css.optionId}>{meta.id}</span>
                            <span className={css.optionAbility}>{t(meta.abilityKey)}</span>
                          </label>
                        ))}
                        <div className={css.customRow}>
                          <input
                            value={customRole}
                            placeholder={t('quickstart.customRole')}
                            onChange={(event) => { setCustomRole(event.target.value) }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') { event.preventDefault(); addCustomRole() }
                            }}
                          />
                          <button type="button" disabled={customRole.trim() === ''} onClick={addCustomRole}>{t('quickstart.addRole')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {currentStep === 'oath' && (
            <section className={css.stepPane} data-step="oath">
              {submitting && <p className={css.busyNote} role="status">{t('quickstart.generating')}</p>}
              <dl className={css.summary}>
                <div className={css.summaryRow}><dt>{t('mode.select')}</dt><dd>{getModeSpec(mode).emoji} {t(getModeSpec(mode).labelKey as Parameters<typeof t>[0])}</dd></div>
                <div className={css.summaryRow}><dt>{t('quickstart.summaryDoctrine')}</dt><dd>{doctrineName}</dd></div>
                <div className={css.summaryRow}><dt>{t('quickstart.summaryAmbition')}</dt><dd>{visualEnabled ? '💥 ' + t('quickstart.ambitionLabel') : t('quickstart.ambitionOff')}</dd></div>
                <div className={css.summaryRow}><dt>{t('quickstart.summarySect')}</dt><dd>{sectName}</dd></div>
                <div className={css.summaryRow}><dt>{t('quickstart.summaryRoster')}</dt><dd><span className={css.chips}>{roster.map(personChip)}</span></dd></div>
                {referenceInput.trim() !== '' && (
                  <div className={css.summaryRow}><dt>{t('quickstart.summaryReference')}</dt><dd>{referenceProfile?.label ?? referenceInput.trim()}</dd></div>
                )}
                <div className={css.summaryRow}><dt>{t('quickstart.summaryVow')}</dt><dd>{goalTrimmed}</dd></div>
              </dl>
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
            {busy ? t('quickstart.busy') : t('quickstart.found')}
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
