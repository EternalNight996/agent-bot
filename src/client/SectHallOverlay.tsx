/**
 * 取经队福地：常驻右侧栏（浮层窗口已删除）。
 *
 * 收起时是一枚可拖动的令牌（唯一入口）；点开令牌 → 右侧栏展开，栏内是
 * 顶部导航 + 有界像素场景 + 设施页内容（t29：页面内容只在右栏内渲染，
 * 不再占用中间内容区，对话与输入框始终保留）。
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ActivityTeam } from './activity-monitor.ts'
import { formatTokens, teamElapsedCounting, teamElapsedMs } from './activity-model.ts'
import type { AgentTeamsTranslate } from './locales.ts'
import { TeamSection } from './ActivityPanel.tsx'
import { HallInbox } from './HallInbox.tsx'
import { MemoryModeBanner } from './MemoryModeBanner.tsx'
import { LibraryPanel } from './LibraryPanel.tsx'
import { CostDetail, useCostReport, money } from './CostLedger.tsx'
import { CostDialog } from './CostDialog.tsx'
import { StagingPlanEditor } from './StagingPlanEditor.tsx'
import { TeamConfigPanel } from './TeamConfigPanel.tsx'
import { QuickStartWizard } from './QuickStartDialog.tsx'
import { ConfigCenter } from './ConfigCenter.tsx'
import { CULTIVATION_ITEMS, captainKey, cultivationFromXp, idleXpPer10s, memberKey } from './cultivation.ts'
import { APP_ICON, SKIN_OPTIONS } from './artwork.ts'
import { ingestCultivation, useCultivationVersion, xpOf } from './cultivation-store.ts'
import { COLLAPSE_HALL_EVENT, OPEN_HALL_SHEET_EVENT, OPEN_HALL_START_EVENT, type HallSheetAction } from './hall-events.ts'
import { ASCENSION_RANKS, ASCENSION_STORY, ASCENSION_TIER_KEYS, ASCENSION_TIPS, rankAtLevel } from './immortals.ts'
import { FACTIONS } from '../factions.ts'
import { getModeSpec, isTeamMode } from '../modes.ts'
import { permissionLabel, roleDuty, roleLabel, rolePrompt } from './role-catalog.ts'
import { addCustomRole, removeCustomRole, useCustomRoles } from './custom-roles.ts'
import { hideLineup, showLineup, useHiddenLineups } from './hidden-lineups.ts'
import { realmPaletteForLevel } from './realm-colors.ts'
import { PLUGIN_REPO, buildAgentPrompt, buildIssueUrl, collectDiagnostics } from './feedback.ts'
import { CAPTAIN_SKIN_OPTIONS, setCaptainSkin, useCaptainSkin } from './captain-skin.ts'
import { PLUGIN_VERSION } from './version.ts'
import { HallSidebar } from './HallSidebar.tsx'
import {
  HALL_CONTENT_HOST, HALL_SIDEBAR_HOST, hallPageForSheet, hallSheetForPage,
  readHallCollapsed, readHallPage, shouldArmHallFallback, useHallHost,
  useHallSidebarVisible, writeHallCollapsed, writeHallPage, type HallPage,
} from './hall-nav.ts'
import { hallMember, setHallMember, useHallMember } from './hall-selection.ts'
import css from './SectHallOverlay.module.css'

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours + 'h ' + String(minutes).padStart(2, '0') + 'm ' + String(seconds).padStart(2, '0') + 's'
}

/** 交流群 / 赞助码由宿主插件路由提供（assets/support）。 */
const SUPPORT_BASE = '/plugins/dsh-super-agent/support'
const supportAsset = (file: string): string => `${SUPPORT_BASE}/${file}`

/** 复制到剪贴板：Clipboard API 失败时退回 execCommand，保持一次点击能复制。 */
async function copyText(text: string): Promise<boolean> {
  if (text === '') return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* 落到 execCommand */ }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

const TOKEN_KEY = 'dsh-super-agent.hallToken'
/** 名册历史列表里的“当前取经队”哨兵。 */
const CURRENT_TEAM_SENTINEL = '__current__'

/** 收起后的令牌尺寸：固定 38×68（Q2：不再随面板高度缩放）。 */
const TOKEN_SIZE = { w: 38, h: 68 } as const

interface TokenPoint {
  readonly x: number
  readonly y: number
}

/** 把令牌夹在窗口内；留 8px 边缘，拖不出屏。 */
function clampToken(x: number, y: number, w: number, h: number): TokenPoint {
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  return {
    x: Math.max(8, Math.min(x, vw - w - 8)),
    y: Math.max(8, Math.min(y, vh - h - 8)),
  }
}

function readTokenPoint(): TokenPoint {
  if (typeof window === 'undefined') return { x: 16, y: 16 }
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<TokenPoint>
      if (typeof parsed.x === 'number' && Number.isFinite(parsed.x)
        && typeof parsed.y === 'number' && Number.isFinite(parsed.y)) {
        return clampToken(parsed.x, parsed.y, TOKEN_SIZE.w, TOKEN_SIZE.h)
      }
    }
  } catch { /* private mode */ }
  // 默认停在右下角：与展开面板同一处，收起时不跳。
  return clampToken(window.innerWidth - TOKEN_SIZE.w - 16, window.innerHeight - TOKEN_SIZE.h - 16, TOKEN_SIZE.w, TOKEN_SIZE.h)
}

function writeTokenPoint(point: TokenPoint): void {
  try { window.localStorage.setItem(TOKEN_KEY, JSON.stringify(point)) } catch { /* private mode */ }
}


type SheetKind = HallSheetAction | 'character' | 'library' | 'home' | 'archive'

/** 「取经队志」里的四个页签（赞助排第一）。 */
type AboutTab = 'sponsor' | 'group' | 'about' | 'feedback'

/** Visual state for the roster dropdown color marking. */
function teamVisualState(team: ActivityTeam): 'done' | 'failed' | 'running' | 'waiting' {
  if (team.tasks.length > 0 && team.tasks.every(task => task.status === 'completed')) return 'done'
  if (team.tasks.some(task => task.status === 'failed')) return 'failed'
  if (team.tasks.some(task => task.status === 'claimed' || task.status === 'in_progress')) return 'running'
  return 'waiting'
}

function stateDot(state: 'done' | 'failed' | 'running' | 'waiting'): string {
  return state === 'done' ? '🟢' : state === 'failed' ? '🔴' : state === 'running' ? '🟡' : '🔵'
}

/** 物品品阶：按解锁等级着色，越晚解锁越贵气（纯展示，不参与数值）。 */
function itemTier(level: number): 'mortal' | 'rare' | 'epic' | 'legendary' {
  if (level >= 2800) return 'legendary'
  if (level >= 350) return 'epic'
  if (level >= 20) return 'rare'
  return 'mortal'
}


export function SectHallOverlay({
  team, history = [], t, sessionId, modelDirectories, openMember, openCaptain,
  onOpenSidebar, onCollapseSidebar,
}: {
  /** 无队伍时缺省：浮层仍常驻，渲染一座只有师父的空福地。 */
  readonly team?: ActivityTeam
  /** 本师父会话下已归档的历史取经队（名册页展示）。 */
  readonly history?: readonly ActivityTeam[]
  readonly t: AgentTeamsTranslate
  /** 当前会话；应用级浮层在个别宿主上可能拿不到，此时只能渲染空福地。 */
  readonly sessionId?: SessionId
  readonly modelDirectories: ModelDirectoryResolver
  readonly openMember: (parentId: SessionId, childId: SessionId) => void
  /** 回到师父所在的主对话（点击场景里的师父）。 */
  readonly openCaptain?: (captainSessionId: SessionId) => void
  /** 展开右侧栏并聚焦福地所在的标签页。 */
  readonly onOpenSidebar?: () => void
  /** 收起右侧栏（回到令牌）。 */
  readonly onCollapseSidebar?: () => void
}) {
  const [collapsed, setCollapsed] = useState(() => readHallCollapsed())
  // 页面即状态：刷新后按 localStorage 里的页面恢复（Q7）。
  const [sheet, setSheet] = useState<SheetKind | undefined>(() => {
    // 网站式默认页：没有记录时落「像素活动」主页（t17），有记录则恢复。
    const page = readHallPage()
    return page === undefined ? 'home' : hallSheetForPage(page) as SheetKind
  })
  // 组队成功后等新队伍落地，再自动打开法脉配置让师父审核；审核完跳到取经队进度。
  const [pendingReview, setPendingReview] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [historyTeamId, setHistoryTeamId] = useState<string | undefined>()
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [archiveArmed, setArchiveArmed] = useState<number | undefined>()
  const [cleanupNotice, setCleanupNotice] = useState('')
  const [archivedTeamIds, setArchivedTeamIds] = useState<readonly string[]>(() => {
    try {
      const raw = window.localStorage.getItem('dsh-super-agent.archivedTeams.v1')
      const value = raw === null ? [] : JSON.parse(raw) as unknown
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    } catch { return [] }
  })
  useEffect(() => {
    try { window.localStorage.setItem('dsh-super-agent.archivedTeams.v1', JSON.stringify(archivedTeamIds)) } catch { /* private mode */ }
  }, [archivedTeamIds])
  // 成员选择放模块级：切子会话会让右栏重挂载，局部 state 会丢。
  const selectedMember = useHallMember()
  const [characterId, setCharacterId] = useState<string | undefined>()
  const previousSessionRef = useRef(sessionId)
  // 法器 / 坐骑 / 技能各选各的，互不覆盖；按角色分开记，来回切换不会丢装备。
  type EquippedSlots = { weapon?: string; mount?: string; skill?: string }
  const [equippedByCharacter, setEquippedByCharacter] = useState<Record<string, EquippedSlots>>({})
  const equipped: EquippedSlots = characterId === undefined ? {} : (equippedByCharacter[characterId] ?? {})
  const captainSkin = useCaptainSkin()
  useCultivationVersion()
  // The app-level overlay can miss the session prop; the team's captain session
  // is a reliable fallback for the cost report.
  const costSessionId = sessionId ?? team?.captainSessionId
  const { report: costReport } = useCostReport(costSessionId)
  // 即使右侧活动面板未挂载，福地也结算修为：师父本人执行任务同样涨功德。
  useEffect(() => {
    const teams = team === undefined ? [...history] : [team, ...history]
    if (teams.length > 0) ingestCultivation(teams, sessionId)
  }, [team, history, sessionId])
  // 取经队志：页签 + 反馈草稿 + 复制结果提示。
  const [aboutTab, setAboutTab] = useState<AboutTab>('sponsor')
  const [settingsTab, setSettingsTab] = useState<'skin' | 'roles' | 'lineups'>('skin')
  const [customName, setCustomName] = useState('')
  const [customRole, setCustomRole] = useState('implementer')
  const [customSkin, setCustomSkin] = useState('demon')
  const [defaultFaction, setDefaultFaction] = useState<string>(() => {
    try { return window.localStorage.getItem('dsh-super-agent.lastFaction') ?? 'pilgrim' } catch { return 'pilgrim' }
  })
  const customRoles = useCustomRoles()
  const hiddenLineups = useHiddenLineups()
  const dutyRoles = [...new Set([
    ...FACTIONS.flatMap(faction => faction.members.map(member => member.role)),
    'writer', 'researcher', 'healer', 'talisman', 'beastmaster', 'puppeteer', 'musician', 'poisoner', 'monk', 'demon',
  ])].sort()
  const zhUi = t('office.roleAutonomy') === '自主度'
  const [feedbackText, setFeedbackText] = useState('')
  const [aboutNotice, setAboutNotice] = useState('')
  const [token, setToken] = useState<TokenPoint>(() => readTokenPoint())
  // 宿主挂载宽限：展开后宿主未就绪时先不显示令牌（F2），200ms 后才允许兜底。
  const [hostGraceOver, setHostGraceOver] = useState(false)
  // t73：只有「我们主动发起的展开」才允许重试 openTab。用户切到右栏别的标签会让宿主卸载，
  // 那种卸载绝不能触发重试，否则会把前台标签抢回取经队协作。
  const pendingOpenRef = useRef(false)
  const tokenDrag = useRef<{
    startX: number; startY: number; baseX: number; baseY: number; lastX: number; lastY: number; moved: boolean
  } | null>(null)

  // 福地常驻：即使当前会话还没有队伍，也保留浮层（空福地里只有师父）。
  const hasTeam = team !== undefined
  // 在行者子会话里福地展示的是主队伍，成员跳转必须用主会话 id 作为 parent。
  const ownerSessionId = (team?.captainSessionId ?? sessionId) as SessionId | undefined
  useEffect(() => {
    if (!pendingReview || !hasTeam) return
    setPendingReview(false)
    // 组队成功后直接进入玄门道统的待批准计划页，而不是总进度。
    setReviewing(false)
    setSheet('config')
    if (collapsed) { setCollapsed(false); writeHallCollapsed(false) }
    onOpenSidebar?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReview, hasTeam])
  const hall: ActivityTeam = team ?? {
    workspace: '',
    teamId: '',
    name: t('office.hallEmptyName'),
    captainSessionId: '',
    phase: 'running',
    members: [],
    tasks: [],
    messageCount: 0,
    captainInbox: [],
  }
  const done = hall.tasks.filter(task => task.status === 'completed').length
  const total = hall.tasks.length
  // 天机阁打开时，切换行者对话后装备页实时跟随当前角色；仅会话变化时触发。
  useEffect(() => {
    if (sheet !== 'character') { previousSessionRef.current = sessionId; return }
    if (previousSessionRef.current === sessionId) return
    previousSessionRef.current = sessionId
    if (sessionId === undefined) return
    if (sessionId === hall.captainSessionId) {
      setCharacterId(hall.captainSessionId)
      return
    }
    const member = hall.members.find(item => item.id === sessionId)
    if (member !== undefined) setCharacterId(member.id || member.name)
  }, [sheet, sessionId, hall.captainSessionId, hall.members])
  // 点击师父：回到他所在的主对话（而不是打开一个“成员子会话”）。
  const goHome = (): void => {
    if (openCaptain !== undefined && hall.captainSessionId !== '') openCaptain(hall.captainSessionId as SessionId)
  }
  // 当前对话框属于谁：师父主对话还是某位行者的子对话。
  const viewingCaptain = sessionId !== undefined && sessionId === hall.captainSessionId
  const viewingMember = sessionId === undefined
    ? undefined
    : hall.members.find(member => member.id === sessionId)
  // 新建任务由师父（主对话）执行：回到主对话并聚焦输入框，用户直接说要建什么。
  const startNewTask = (): void => {
    focusProgress()
    goHome()
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-composer-card] [contenteditable="true"][role="textbox"], [data-composer-card] textarea')?.focus()
    }, 160)
  }
  // 天机阁：打开当前角色（或师父）的装备页。
  const openGear = (): void => {
    const memberRef = viewingMember === undefined ? undefined : (viewingMember.id || viewingMember.name)
    const target = viewingCaptain ? hall.captainSessionId : memberRef ?? hall.captainSessionId
    if (target !== '') {
      setCharacterId(target)
      setSheet('character')
    }
  }
  const staged = hall.phase === 'staged'
  // 令牌固定 38×68：右栏/浮层都不再影响它（Q2）。
  const tokenSize = { w: TOKEN_SIZE.w, h: TOKEN_SIZE.h }
  const tokenAt = clampToken(token.x, token.y, tokenSize.w, tokenSize.h)

  // 墙面设施/剑盒/名册 → 面板上方的内容气泡。
  useEffect(() => {
    const open = (event: Event): void => {
      const action = (event as CustomEvent<{ action?: HallSheetAction }>).detail?.action
      if (action !== undefined) setSheet(action)
    }
    window.addEventListener(OPEN_HALL_SHEET_EVENT, open)
    return () => { window.removeEventListener(OPEN_HALL_SHEET_EVENT, open) }
  }, [])

  // 页面即状态：只写 localStorage（t29：不再调用 selectPanel，中间内容区永远不被替换）。
  useEffect(() => {
    writeHallPage(sheet === undefined ? undefined : hallPageForSheet(sheet))
  }, [sheet])

  // ① 令牌在任何落地态都能把福地带出来：先把 main 还给对话（页面态会占住 main 槽，
  //    右栏是 session-bound 的，被占时 openTab 无处可挂），再展开右栏。
  const bringHallBack = (): void => {
    pendingOpenRef.current = true
    onOpenSidebar?.()
  }

  // ③ 失败不静默：宽限失败时重试一次，并给出可诊断的告警（而不是把异常吞掉）。
  const retryOpenSidebar = (): void => {
    console.warn('agent-teams: hall sidebar host not mounted yet, retrying openTab once')
    onOpenSidebar?.()
  }

  const activateToken = (): void => {
    if (collapsed) { toggleCollapsed(); return }
    // 已展开但侧栏被宿主收起（宿主回收 → 令牌仍显示）：再点一次把它调回来。
    bringHallBack()
  }

  // t43：新建任务/组队成功后自动展开右栏并停在「总进度」页。
  const focusProgress = (): void => {
    pendingOpenRef.current = true
    setReviewing(false)
    setSheet('board')
    if (collapsed) { setCollapsed(false); writeHallCollapsed(false) }
    onOpenSidebar?.()
  }

  const toggleCollapsed = (): void => {
    const next = !collapsed
    setCollapsed(next)
    writeHallCollapsed(next)
    if (next) {
      // 收起成一枚令牌时，设施页一并收起（t29：只在右栏内存在，不涉及中间区）。
      setSheet(undefined)
      onCollapseSidebar?.()
      return
    }
    bringHallBack()
  }

  // 令牌可拖动：拖到任意角落，位置记在 localStorage；没拖动就是点击展开。
  const beginTokenDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    const drag = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: tokenAt.x,
      baseY: tokenAt.y,
      lastX: tokenAt.x,
      lastY: tokenAt.y,
      moved: false,
    }
    tokenDrag.current = drag
    const cleanup = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    const move = (moveEvent: PointerEvent): void => {
      if (tokenDrag.current !== drag) return
      const dx = moveEvent.clientX - drag.startX
      const dy = moveEvent.clientY - drag.startY
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return
      drag.moved = true
      const next = clampToken(drag.baseX + dx, drag.baseY + dy, tokenSize.w, tokenSize.h)
      drag.lastX = next.x
      drag.lastY = next.y
      setToken(next)
    }
    const up = (): void => {
      cleanup()
      if (tokenDrag.current !== drag) return
      tokenDrag.current = null
      if (drag.moved) {
        writeTokenPoint({ x: drag.lastX, y: drag.lastY })
        return
      }
      activateToken()
    }
    const cancel = (): void => {
      cleanup()
      if (tokenDrag.current === drag) tokenDrag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  // 面板尺寸变化 → 令牌跟着变大/变小，并夹回可视区。
  useEffect(() => {
    setToken((current) => {
      const next = clampToken(current.x, current.y, tokenSize.w, tokenSize.h)
      return next.x === current.x && next.y === current.y ? current : next
    })
  }, [tokenSize.w, tokenSize.h])

  // t84：右栏「取经队协作」标签被用户关掉时，福地自己也收成令牌（与 Esc 同一条收起逻辑）。
  useEffect(() => {
    const onCollapse = (): void => {
      if (collapsed) return
      setCollapsed(true)
      writeHallCollapsed(true)
      onCollapseSidebar?.()
    }
    window.addEventListener(COLLAPSE_HALL_EVENT, onCollapse)
    return () => { window.removeEventListener(COLLAPSE_HALL_EVENT, onCollapse) }
  }, [collapsed, onCollapseSidebar])

  // Esc（t29 简化）：只有一级——收起右栏回到令牌，不再有"退页回对话"。
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (!collapsed) { setCollapsed(true); writeHallCollapsed(true); onCollapseSidebar?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [collapsed, onCollapseSidebar])

  // 关掉“审核法脉”这一步时直接去取经队进度，而不是回到空福地。
  const finishSheet = (): void => {
    if (reviewing) {
      setReviewing(false)
      setSheet(sessionId === undefined ? 'board' : 'library')
      return
    }
    setSheet(undefined)
  }
  const toggleSheet = (kind: SheetKind): void => {
    if (sheet === kind) { finishSheet(); return }
    setReviewing(false)
    setSheet(kind)
  }

  // 对话头部的「组队取经」只打开常驻福地的内联 start 页；不再落到右侧浮窗
  //（浮窗没有 start 分支，会误显示成师父收件箱）。
  useEffect(() => {
    const openStart = (): void => {
      pendingOpenRef.current = true
      setReviewing(false)
      setSheet('start')
      if (collapsed) { setCollapsed(false); writeHallCollapsed(false) }
      onOpenSidebar?.()
    }
    window.addEventListener(OPEN_HALL_START_EVENT, openStart)
    return () => { window.removeEventListener(OPEN_HALL_START_EVENT, openStart) }
  }, [collapsed, onOpenSidebar])

  if (typeof document === 'undefined') return null

  // 组队：和功德碑/进度一样在面板左侧的内容气泡里展示，不弹独立窗口。
  const startSect = (): void => {
    setSheet(current => current === 'start' ? undefined : 'start')
  }

  // 名册清理：归档所有已终止的旧取经队（当前师父的团队由宿主排除）。
  const cleanupTeams = async (): Promise<void> => {
    if (cleanupBusy || costSessionId === undefined) return
    setCleanupBusy(true)
    setCleanupNotice('')
    try {
      const request = async (dryRun: boolean): Promise<{ candidates?: { id: string; name: string }[]; archived?: string[] }> => {
        const response = await fetch('/plugins/dsh-super-agent/cleanup', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: costSessionId, dry_run: dryRun, older_than_days: 0, include_archived: true }),
        })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return await response.json() as { candidates?: { id: string; name: string }[]; archived?: string[] }
      }
      if (archiveArmed === undefined) {
        const preview = await request(true)
        const candidates = preview.candidates ?? []
        if (candidates.length === 0) {
          setCleanupNotice(t('office.archiveCleanupEmpty'))
          return
        }
        setArchiveArmed(candidates.length)
        return
      }
      const result = await request(false)
      setArchiveArmed(undefined)
      const archived = result.archived ?? []
      setArchivedTeamIds(current => [...new Set([...current, ...archived])])
      // 归档后清空下拉选择，避免继续停留在已归档取经队上。
      setHistoryTeamId(undefined)
      setCleanupNotice(t('office.archiveCleanupDone', { count: archived.length }))
    } catch {
      setCleanupNotice(t('office.archiveCleanupFailed'))
    } finally {
      setCleanupBusy(false)
    }
  }

  // 取经队志里的复制结果：2.4 秒后自动消失。
  const flashAbout = (text: string): void => {
    setAboutNotice(text)
    window.setTimeout(() => setAboutNotice(current => (current === text ? '' : current)), 2400)
  }

  const renderSheet = (): React.ReactNode => {
    if (sheet === undefined) return null
    // 无队伍时墙面设施 / 名册仍然可点：给出「尚未组队」的提示与组队入口。
    const noTeamHint = (
      <div className={css.settings}>
        <p className={css.settingsHint}>{t('workspace.emptyTitle')}</p>
        <p className={css.settingsMeta}>{t('workspace.emptyBody')}</p>
        <button type="button" className={css.settingsButton} data-control="hall-start" onClick={startSect}>
          <span aria-hidden>⛩</span> {t('quickstart.entry')}
        </button>
      </div>
    )
    const memberByName = (name: string): { id: string } | undefined => shownTeam.members.find(item => item.name === name)
    // 主清单行 → 该角色会话；未分派/无会话则置灰不可点（避免点出空白页）。
    const jumpToMember = (name: string): void => {
      if (name === '') return
      const member = memberByName(name)
      if (member === undefined || member.id === '') return
      setHallMember(name)
      const owner = ownerSessionId ?? shownTeam.captainSessionId
      if (owner === '') return
      openMember(owner as SessionId, member.id as SessionId)
    }
    const clickable = (name: string): boolean => name !== '' && (memberByName(name)?.id ?? '') !== ''
    const visibleHistory = history.filter(team => !archivedTeamIds.includes(team.teamId))
    const viewingCurrent = hasTeam && (historyTeamId === undefined || historyTeamId === CURRENT_TEAM_SENTINEL)
    const selectedHistory = visibleHistory.find(team => team.teamId === historyTeamId)
    const selectedTeamId = viewingCurrent ? hall.teamId : selectedHistory?.teamId
  const selectedTeam = viewingCurrent ? hall : selectedHistory
  // 切历史时，首页统计/需求清单/队伍卡都必须跟随所选历史队伍，而不是当前队。
  const shownTeam = selectedTeam ?? hall
  const modeId = shownTeam.planSummary?.mode
  const modeName = modeId !== undefined && isTeamMode(modeId) ? getModeSpec(modeId).name : '—'
  const memberTasks = selectedMember === undefined ? [] : shownTeam.tasks.filter(task => task.assignee === selectedMember)
  const memberPassed = memberTasks.filter(task => task.status === 'completed').length
  const selectedTeamUpdatedAt = selectedTeam === undefined ? undefined : Math.max(selectedTeam.createdAt ?? 0, ...selectedTeam.tasks.map(task => task.updatedAt ?? 0))
    const selectedState = viewingCurrent ? teamVisualState(hall) : selectedHistory === undefined ? 'waiting' : teamVisualState(selectedHistory)
    const costByTeam = new Map((costReport?.by_team ?? []).map(item => [item.teamId, item.usd]))
    const activeCost = costReport?.by_team.find(item => item.teamId === shownTeam.teamId)
    const passedCount = shownTeam.tasks.filter(task => task.state === 'completed').length
    const runningCount = shownTeam.tasks.filter(task => task.state === 'running' || task.state === 'claimed' || task.state === 'open').length
    const blockedCount = shownTeam.tasks.filter(task => task.state === 'blocked' || task.state === 'failed' || task.state === 'cancelled').length
    // 已结束/有失败/被停止的队伍必须停表：沿用 teamElapsedMs 的冻结语义。
    const elapsedText = formatDuration(teamElapsedMs({ ...shownTeam, updatedAt: selectedTeamUpdatedAt }, Date.now()))
    const historyTasks = hall.tasks.filter(task => task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')
    const taskStatusLabel = (status: string): string => status === 'completed'
      ? t('task.status.completed')
      : status === 'failed' ? t('task.status.failed') : t('task.status.cancelled')
    // t47：没有显式选中角色时，回落到当前查看的行者/师父，避免天机阁误显示空态。
    const effectiveCharacterId = characterId ?? (viewingMember !== undefined
      ? (viewingMember.id || viewingMember.name)
      : (hasTeam ? hall.captainSessionId : undefined))
    const character = effectiveCharacterId === undefined || effectiveCharacterId === ''
      ? undefined
      : effectiveCharacterId === hall.captainSessionId
        ? { id: hall.captainSessionId, name: t('office.captain'), key: captainKey(hall.name), isCaptain: true }
        : (() => {
            const member = hall.members.find(item => item.id === effectiveCharacterId || item.name === effectiveCharacterId)
            return member === undefined
              ? undefined
              : { id: member.id || member.name, name: member.name, key: memberKey(member.name), isCaptain: false }
          })()
    const characterCultivation = character === undefined ? undefined : cultivationFromXp(xpOf(character.key))
    // 功德榜跟着「当前打开的对话」走：师父看师父，行者看行者。
    const viewerKey = viewingCaptain
      ? captainKey(hall.name)
      : viewingMember === undefined ? undefined : memberKey(viewingMember.name)
    const viewerCultivation = viewerKey === undefined ? undefined : cultivationFromXp(xpOf(viewerKey))
    const viewerName = viewingCaptain ? t('office.captain') : viewingMember?.name
    const viewerRank = viewerCultivation === undefined ? undefined : rankAtLevel(viewerCultivation.level)
    // 功德榜先看「本宗谁在榜上」：按修为从高到低排。
    const roster = !hasTeam
      ? []
      : [
          { key: captainKey(hall.name), name: t('office.captain'), cultivation: cultivationFromXp(xpOf(captainKey(hall.name))) },
          ...hall.members.map(member => ({
            key: memberKey(member.name),
            name: member.name,
            cultivation: cultivationFromXp(xpOf(memberKey(member.name))),
          })),
        ].sort((left, right) => right.cultivation.level - left.cultivation.level
          || right.cultivation.xp - left.cultivation.xp)
    // 取经队志：反馈诊断（只在打开该页时采样）。
    const diagnostics = sheet === 'about' && aboutTab === 'feedback'
      ? collectDiagnostics({
          version: PLUGIN_VERSION,
          team: hasTeam
            ? {
                name: hall.name,
                phase: hall.phase,
                members: hall.members.length,
                tasks: {
                  total: hall.tasks.length,
                  done,
                  failed: hall.tasks.filter(task => task.status === 'failed').length,
                  running: hall.tasks.filter(task => task.state === 'running').length,
                },
              }
            : undefined,
        })
      : ''
    const openIssue = (): void => {
      if (feedbackText.trim() === '') {
        flashAbout(t('about.feedbackNeedText'))
        return
      }
      const url = buildIssueUrl({ description: feedbackText, diagnostics, version: PLUGIN_VERSION })
      try {
        window.open(url, '_blank', 'noopener')
      } catch {
        flashAbout(t('about.feedbackOpenFail'))
      }
    }
    const copyDiagnostics = async (): Promise<void> => {
      const ok = await copyText(diagnostics)
      flashAbout(t(ok ? 'about.feedbackCopied' : 'about.feedbackCopyFail'))
    }
    const copyPrompt = async (): Promise<void> => {
      const locale = typeof navigator !== 'undefined' && String(navigator.language ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh'
      const ok = await copyText(buildAgentPrompt({ description: feedbackText, diagnostics, locale }))
      flashAbout(t(ok ? 'about.feedbackCopied' : 'about.feedbackCopyFail'))
    }
    const title = sheet === 'home' ? t('hall.home')
      : sheet === 'settings' ? t('office.panelConfig')
      : sheet === 'start' ? t('quickstart.title')
        : sheet === 'character' ? t('office.equipment')
          : sheet === 'ranks' ? t('office.ascension')
            : sheet === 'archive' ? t('office.archive') : sheet === 'about' ? t('office.aboutTitle')
              : sheet === 'inbox' ? t('workspace.inbox')
              : sheet === 'teams' ? t('office.facility.teams')
                : sheet === 'board' ? t('workspace.tabBoard')
                  : sheet === 'library' ? t('library.title')
                    : sheet === 'config' && hasTeam && !staged ? t('library.title')
                      : t('workspace.tabConfig')
    return (
      <aside
        className={css.sheet}
        data-hall-sheet={sheet}
        role="region"
        aria-label={title}
      >
        <header className={css.sheetHead}>
          <span className={css.sheetTitle}>{title}</span>
          {hasTeam && (sheet === 'board' || sheet === 'library' || (sheet === 'config' && !staged)) && (
            <button type="button" className={css.sheetAction} onClick={startNewTask} title={t('office.newTaskHint')}>
              ＋ {t('office.newTask')}
            </button>
          )}
          <button type="button" className={css.sheetClose} onClick={finishSheet} aria-label={t('office.closePanel')}>×</button>
        </header>
        <div className={css.sheetBody}>
          {sheet === 'ranks' ? (
            <div className={css.ranks}>
              <p className={css.settingsHint}>{t('office.ascensionIntro')}</p>
              {viewerCultivation !== undefined && viewerName !== undefined && (
                <div className={css.rankHero}>
                  <span className={css.rankHeroName}>
                    {viewerName} · <span style={{ color: realmPaletteForLevel(viewerCultivation.level).border }}>Lv.{viewerCultivation.level} {t(viewerCultivation.rankKey)}</span>
                  </span>
                  <div className={css.xpTrack}><span style={{ width: `${Math.round(viewerCultivation.ratio * 100)}%`, background: realmPaletteForLevel(viewerCultivation.level).bar }} /></div>
                  <span className={css.settingsMeta}>{viewerCultivation.xp} / {viewerCultivation.next} XP · {t('office.ascensionCurrent')}</span>
                </div>
              )}
              {roster.length > 0 && (
                <>
                  <span className={css.historyTitle}>{t('office.ascensionSect')}</span>
                  <ol className={css.rosterList}>
                    {roster.map((entry, index) => (
                      <li key={entry.key} className={css.rosterRow}>
                        <span className={css.rosterIndex}>{index + 1}</span>
                        <span className={css.rosterName}>{entry.name}</span>
                        <span className={css.rosterLevel} style={{ color: realmPaletteForLevel(entry.cultivation.level).border }}>
                          Lv.{entry.cultivation.level} · {t(entry.cultivation.rankKey)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              <span className={css.historyTitle}>{t('office.ascensionRealmList')}</span>
              <p className={css.settingsHint}>{t('office.ascensionTiers')}</p>
              <ol className={css.rankList}>
                {ASCENSION_RANKS.map((rank, index) => {
                  const current = viewerRank?.realm === rank.realm
                  const previous = ASCENSION_RANKS[index - 1]
                  const showTier = previous?.tier !== rank.tier
                  return (
                    <Fragment key={rank.realm}>
                      {showTier && (
                        <li className={css.rankTierRow}>
                          <span>{t(ASCENSION_TIER_KEYS[rank.tier])}</span>
                          <small>{t(rank.tier === 'heaven' ? 'office.ascensionSublevelsHeaven' : 'office.ascensionSublevelsMortal')}</small>
                        </li>
                      )}
                      <li className={css.rankRow} data-current={current || undefined}>
                        <div className={css.rankTop}>
                          <span className={css.rankName}>{t(rank.realm)}</span>
                          <span className={css.rankRange} style={{ color: realmPaletteForLevel(rank.levelMin).border }}>
                            Lv.{rank.levelMin}–{rank.levelMax}
                          </span>
                          {current && <span className={css.rankCurrent}>{t('office.ascensionYouAre')}</span>}
                        </div>
                        <p className={css.rankDesc}>{t(rank.descKey)}</p>
                        <p className={css.rankExample}>{t('office.ascensionExample')}{rank.example}</p>
                      </li>
                    </Fragment>
                  )
                })}
              </ol>
              <span className={css.historyTitle}>{t('office.ascensionFast')}</span>
              <ul className={css.tips}>
                {ASCENSION_TIPS.map(key => <li key={key} className={css.tip}>{t(key)}</li>)}
              </ul>
              <span className={css.historyTitle}>{t('office.ascensionStory')}</span>
              <div className={css.story}>
                {ASCENSION_STORY.map(key => <p key={key}>{t(key)}</p>)}
              </div>
            </div>
          ) : sheet === 'about' ? (
            <div className={css.about}>
              <div className={css.aboutTabs} role="tablist">
                {([
                  ['sponsor', 'about.tab.sponsor'],
                  ['group', 'about.tab.group'],
                  ['about', 'about.tab.about'],
                  ['feedback', 'about.tab.feedback'],
                ] as const).map(([id, key]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    className={css.aboutTab}
                    data-active={aboutTab === id || undefined}
                    onClick={() => { setAboutTab(id); setAboutNotice('') }}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
              {aboutTab === 'group' ? (
                <div className={css.aboutSection}>
                  <p className={css.settingsHint}>{t('about.groupHint')}</p>
                  <div className={css.qrGrid}>
                    <figure className={css.qrCard}>
                      <img src={supportAsset('group-qr.jpg')} alt={t('about.groupCaption')} loading="lazy" />
                      <figcaption>{t('about.groupCaption')}</figcaption>
                    </figure>
                    <figure className={css.qrCard}>
                      <img src={supportAsset('group-wechat.jpg')} alt={t('about.groupCaptionWechat')} loading="lazy" />
                      <figcaption>{t('about.groupCaptionWechat')}</figcaption>
                    </figure>
                  </div>
                  <p className={css.settingsHint}>{t('about.groupNote')}</p>
                  <p className={css.settingsMeta}>{t('about.groupFallback')}</p>
                  <div className={css.aboutActions}>
                    <a className={css.aboutLink} href={PLUGIN_REPO} target="_blank" rel="noreferrer">⌂ {t('about.repo')} ↗</a>
                  </div>
                </div>
              ) : aboutTab === 'sponsor' ? (
                <div className={css.aboutSection}>
                  <p className={css.settingsHint}>{t('about.sponsorHint')}</p>
                  <div className={css.qrGrid}>
                    <figure className={css.qrCard}>
                      <img src={supportAsset('wechat-pay.jpg')} alt={t('about.sponsorPay')} loading="lazy" />
                      <figcaption>{t('about.sponsorPay')}</figcaption>
                    </figure>
                    <figure className={css.qrCard}>
                      <img src={supportAsset('wechat-reward.jpg')} alt={t('about.sponsorReward')} loading="lazy" />
                      <figcaption>{t('about.sponsorReward')}</figcaption>
                    </figure>
                  </div>
                  <p className={css.settingsHint}>{t('about.sponsorNote')}</p>
                  <div className={css.aboutActions}>
                    <a className={css.aboutLink} href={PLUGIN_REPO + '/blob/main/SPONSOR.md'} target="_blank" rel="noreferrer">☕ {t('about.sponsorLink')} ↗</a>
                  </div>
                </div>
              ) : aboutTab === 'about' ? (
                <div className={css.aboutSection}>
                  <p className={css.settingsHint}>{t('about.intro')}</p>
                  <div className={css.aboutMeta}>
                    <span>{t('about.version')}: {PLUGIN_VERSION}</span>
                    <span>{t('about.author')}: 惠州市梦游科技有限公司</span>
                    <span>{t('about.license')}: MIT</span>
                  </div>
                  <p className={css.settingsHint}>{t('about.companyNote')}</p>
                  <div className={css.aboutActions}>
                    <a className={css.aboutLink} href={PLUGIN_REPO} target="_blank" rel="noreferrer">⌂ {t('about.repo')} ↗</a>
                    <a className={css.aboutLink} href={PLUGIN_REPO + '/issues'} target="_blank" rel="noreferrer">🐞 {t('about.issues')} ↗</a>
                    <a className={css.aboutLink} href={PLUGIN_REPO + '/releases'} target="_blank" rel="noreferrer">🏷 {t('about.releases')} ↗</a>
                  </div>
                </div>
              ) : (
                <div className={css.aboutSection}>
                  <p className={css.settingsHint}>{t('about.feedbackWhy')}</p>
                  <textarea
                    className={css.feedbackText}
                    value={feedbackText}
                    onChange={(event) => setFeedbackText(event.target.value)}
                    placeholder={t('about.feedbackPlaceholder')}
                    rows={4}
                  />
                  <div className={css.feedbackDiagHead}>
                    <span>{t('about.feedbackDiag')}</span>
                    <button type="button" className={css.sheetAction} onClick={() => { void copyDiagnostics() }}>{t('about.feedbackCopyDiag')}</button>
                  </div>
                  <pre className={css.feedbackDiag}>{diagnostics}</pre>
                  <p className={css.settingsMeta}>{t('about.feedbackPrivacy')}</p>
                  <div className={css.aboutActions}>
                    <button type="button" className={css.sheetAction} onClick={openIssue}>🚀 {t('about.feedbackOpenIssue')}</button>
                    <button type="button" className={css.sheetAction} onClick={() => { void copyPrompt() }}>🤖 {t('about.feedbackCopyPrompt')}</button>
                  </div>
                  {aboutNotice !== '' && <p className={css.aboutNotice}>{aboutNotice}</p>}
                </div>
              )}
            </div>
          ) : sheet === 'settings' ? (
            <ConfigCenter t={t} sessionId={sessionId} onFeedback={() => { setSheet('about'); setAboutTab('feedback') }} />
          ) : sheet === 'start' ? (
            sessionId === undefined
              ? <p className={css.settingsHint}>{t('workspace.emptyTitle')}</p>
              : <QuickStartWizard
                  sessionId={sessionId}
                  existingTeam={hasTeam}
                  t={t}
                  onDone={() => { setSheet(undefined) }}
                  onFounded={() => { setPendingReview(true) }}
                />
          ) : sheet === 'character' ? (
            character === undefined || characterCultivation === undefined ? (
              <p className={css.settingsHint}>{t('workspace.emptyTitle')}</p>
            ) : (
              <div className={css.character}>
                <div className={css.characterHead}>
                  <span className={css.characterName}>{character.name}</span>
                  <span className={css.characterLevel} style={{ color: realmPaletteForLevel(characterCultivation.level).border }}>
                    Lv.{characterCultivation.level} {t(characterCultivation.rankKey)}
                  </span>
                </div>
                <div className={css.xpTrack}><span style={{ width: `${Math.round(characterCultivation.ratio * 100)}%`, background: realmPaletteForLevel(characterCultivation.level).bar }} /></div>
                <p className={css.settingsMeta}>{characterCultivation.xp} / {characterCultivation.next} XP</p>
                <p className={css.settingsMeta}>{t('office.levelEarnHint')}</p>
                <p className={css.settingsMeta}>{t('office.equipLiveHint')}</p>
                <p className={css.settingsMeta}>{t('office.idleGain', { xp: idleXpPer10s(characterCultivation.level) })}</p>
                {([
                  { kind: 'weapon', title: t('office.weapon'), hint: undefined },
                  { kind: 'mount', title: t('office.mounts'), hint: t('office.mountHint') },
                  { kind: 'skill', title: t('office.skills'), hint: undefined },
                ] as const).map(section => {
                  const items = CULTIVATION_ITEMS.filter(item => item.kind === section.kind)
                  const unlocked = items.filter(item => characterCultivation.level >= item.level).length
                  // 未选坐骑时默认步行：装备栏要如实反映场景里的形态。
                  const equippedMount = equipped.mount ?? 'mount-walk'
                  return (
                    <section key={section.kind} className={css.inventorySection} data-kind={section.kind}>
                      <header className={css.sectionHead}>
                        <span className={css.historyTitle}>{section.title}</span>
                        <span className={css.sectionCount}>{unlocked}/{items.length}</span>
                      </header>
                      {section.hint !== undefined && <p className={css.sectionHint}>{section.hint}</p>}
                      <div className={css.inventory}>
                        {items.map(item => {
                          const locked = characterCultivation.level < item.level
                          const isEquipped = section.kind === 'mount'
                            ? equippedMount === item.id
                            : equipped[item.kind] === item.id
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={css.item}
                              data-kind={item.kind}
                              data-tier={itemTier(item.level)}
                              data-locked={locked || undefined}
                              data-equipped={isEquipped || undefined}
                              disabled={locked}
                              aria-pressed={isEquipped}
                              title={`${t(item.key as Parameters<typeof t>[0])} · Lv.${item.level}`}
                              onClick={() => {
                                if (locked) return
                                setEquippedByCharacter(current => ({
                                  ...current,
                                  [character.id]: { ...current[character.id], [item.kind]: item.id },
                                }))
                                const label = t(item.key as Parameters<typeof t>[0])
                                if (item.kind === 'mount') {
                                  window.dispatchEvent(new CustomEvent('agent-teams:mount', {
                                    detail: { id: character.id, form: item.form ?? 'off', mountId: item.id, label },
                                  }))
                                } else {
                                  window.dispatchEvent(new CustomEvent('agent-teams:equip', {
                                    detail: { id: character.id, kind: item.kind, tier: item.level, itemId: item.id, label },
                                  }))
                                }
                              }}
                            >
                              <span className={css.itemIcon} aria-hidden>{item.icon}</span>
                              <span className={css.itemName}>{t(item.key as Parameters<typeof t>[0])}</span>
                              <span className={css.itemFoot}>
                                <span className={css.itemLevel}>Lv.{item.level}</span>
                                {locked
                                  ? <span className={css.itemBadge} data-tone="locked">{t('office.locked')}</span>
                                  : isEquipped ? <span className={css.itemBadge}>{t('office.equipped')}</span> : null}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            )
          ) : sheet === 'library' ? (
            sessionId === undefined
              ? <p className={css.settingsHint}>{t('library.empty')}</p>
              : <LibraryPanel sessionId={sessionId} t={t} onStartTeam={startSect} />
          ) : sheet === 'inbox' ? (
            <HallInbox messages={hall.captainInbox} t={t} />
          ) : sheet === 'config' ? (
            !hasTeam
              ? noTeamHint
              : staged && (sessionId ?? hall.captainSessionId) !== undefined
                // Approval still needs the plan editor: a staged plan must stay reviewable.
                ? <StagingPlanEditor team={hall} sessionId={sessionId} modelDirectory={modelDirectories.directoryFor((sessionId ?? hall.captainSessionId) as SessionId)} onContinuePlanning={() => { setSheet(undefined) }} onDiscarded={() => { setSheet(undefined) }} t={t} />
                // The running 藏经阁 is the live library view (replaces the
                // static member/contract panel the user asked to drop).
                : sessionId !== undefined
                  ? <LibraryPanel sessionId={sessionId} t={t} onStartTeam={startSect} />
                  : <TeamConfigPanel
                      team={hall}
                      t={t}
                      onContinue={() => { setSheet(current => current ?? 'home') }}
                    />
          ) : sheet === 'teams' ? (
            <div className={css.history}>
              {/* 已组队并跑过任务后，山门→名册仍然保留组队入口；已有取经队时向导会提示替换。 */}
              <div className={css.historyHead}>
                <select
                  className={css.historySelect}
                  data-state={selectedState}
                  aria-label={t('office.historyTeams')}
                  value={viewingCurrent ? CURRENT_TEAM_SENTINEL : selectedHistory?.teamId ?? ''}
                  onChange={(event) => { setHistoryTeamId(event.currentTarget.value) }}
                >
                  {!hasTeam && visibleHistory.length === 0 && (
                    <option value="">{t('office.historyEmpty')}</option>
                  )}
                  {hasTeam && (
                    <option value={CURRENT_TEAM_SENTINEL}>
                      {stateDot(teamVisualState(hall))} {hall.name} · {t('office.historyCurrent')} · {done}/{total} · {money(costByTeam.get(hall.teamId) ?? 0)}
                    </option>
                  )}
                  {visibleHistory.map(team => {
                    const completed = team.tasks.filter(task => task.status === 'completed').length
                    return (
                      <option key={team.teamId} value={team.teamId}>
                        {stateDot(teamVisualState(team))} {team.name} · {t('office.historyPast')} · {completed}/{team.tasks.length} · {money(costByTeam.get(team.teamId) ?? 0)}
                      </option>
                    )
                  })}
                </select>
                <button type="button" className={css.historyStartSmall} onClick={startSect} title={t('quickstart.entryTitle')}>
                  <span aria-hidden>⛩</span>{t('quickstart.entry')}
                </button>
                {costSessionId !== undefined && (
                  <button type="button" className={`${css.historyStartSmall} ${css.archiveButton}`} data-danger onClick={() => { void cleanupTeams() }} disabled={cleanupBusy} title={t('office.archiveCleanupHint')}>
                    <span aria-hidden>🗄</span>{cleanupBusy ? t('office.archiveBusy') : t('office.archiveCleanup')}
                  </button>
                )}
                {archiveArmed !== undefined && (
                  <span role="alertdialog" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#ffd7a0' }}>
                    <span>{t('office.archiveCleanupConfirm', { count: archiveArmed })}</span>
                    <button type="button" onClick={() => { void cleanupTeams() }}>{t('office.archiveCleanup')}</button>
                    <button type="button" onClick={() => { setArchiveArmed(undefined) }}>{t('quickstart.cancel')}</button>
                  </span>
                )}
              
                        </div>
              {cleanupNotice !== '' && <p className={css.settingsHint} role="status">{cleanupNotice}</p>}
              {!hasTeam && visibleHistory.length === 0 && historyTasks.length === 0 && (
                <p className={css.settingsHint}>{t('office.historyEmpty')}</p>
              )}
              {(hasTeam || visibleHistory.length > 0) && (
                <div className={css.historyBlock}>
                  {selectedHistory !== undefined ? (
                    <div className={css.historyDetail}>
                      <TeamSection
                        team={selectedHistory}
                        t={t}
                        historic
                        workspace
                        onOpenCaptain={openCaptain === undefined ? undefined : () => { setHallMember(undefined); openCaptain(selectedHistory.captainSessionId as SessionId) }}
                        onNavigate={(_parent, child) => { if (ownerSessionId !== undefined) openMember(ownerSessionId, child) }}
                      />
                    </div>
                  ) : null}
                </div>
              )}
              {historyTasks.length > 0 && (
                <div className={css.historyBlock}>
                  <span className={css.historyTitle}>{t('office.taskHistory')}</span>
                  <ul className={css.historyTasks}>
                    {historyTasks.map(task => (
                      <li key={task.id} className={css.historyTask}>
                        <span className={css.historyTaskId}>{task.id}</span>
                        <span className={css.historyTaskSubject} title={task.subject}>{task.subject}</span>
                        <span className={css.historyTaskWho}>{task.assignee || '—'}</span>
                        <span className={css.historyTaskState} data-state={task.state}>{taskStatusLabel(task.status)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedTeamId !== undefined && (
                <CostDetail
                  sessionId={costSessionId}
                  teamId={selectedTeamId}
                  t={t}
                  createdAt={selectedTeam?.createdAt}
                  updatedAt={selectedTeamUpdatedAt}
                  running={selectedTeam !== undefined && teamElapsedCounting(selectedTeam)}
                />
              )}
            </div>
          ) : (
            !hasTeam
              ? noTeamHint
              : (
                <>
                  {sheet === 'home' && (
                    <section className={css.homeDashboard}>
                      {(hasTeam || visibleHistory.length > 0) && (
                        <div className={css.historyHead} data-control="hall-history">
                          <select
                            className={css.historySelect}
                            data-state={selectedState}
                            aria-label={t('office.historyTeams')}
                            value={viewingCurrent ? CURRENT_TEAM_SENTINEL : selectedHistory?.teamId ?? ''}
                            onChange={(event) => { setHistoryTeamId(event.currentTarget.value) }}
                          >
                            {hasTeam && (
                              <option value={CURRENT_TEAM_SENTINEL}>
                                {stateDot(teamVisualState(hall))} {hall.name} · {t('office.historyCurrent')} · {done}/{total} · {money(costByTeam.get(hall.teamId) ?? 0)}
                              </option>
                            )}
                            {visibleHistory.map(team => {
                              const completed = team.tasks.filter(task => task.status === 'completed').length
                              return (
                                <option key={team.teamId} value={team.teamId}>
                                  {stateDot(teamVisualState(team))} {team.name} · {t('office.historyPast')} · {completed}/{team.tasks.length} · {money(costByTeam.get(team.teamId) ?? 0)}
                                </option>
                              )
                            })}
                          </select>
                        
                          <button type="button" className={css.historyStartSmall} onClick={startSect} title={t('quickstart.entryTitle')}>
                            <span aria-hidden>⛩</span>{t('quickstart.entry')}
                          </button>
                        </div>
                      )}
                      <div className={css.homeStats}>
                        <span className={css.homeStat} data-tone="pass"><strong>{passedCount}/{shownTeam.tasks.length}</strong><small>{t('home.passed')}</small></span>
                        <span className={css.homeStat}><strong>{runningCount}</strong><small>{t('home.running')}</small></span>
                        <span className={css.homeStat} data-tone="blocked"><strong>{blockedCount}</strong><small>{t('home.blocked')}</small></span>
                        <span className={css.homeStat} data-tone="mode"><strong>{modeName}</strong><small>{t('home.mode')}</small></span>
                        <span className={css.homeStat}><strong>{elapsedText}</strong><small>{t('home.elapsed')}</small></span>
                        <span className={css.homeStat}><strong>{formatTokens(activeCost?.total_tokens ?? 0)}</strong><small>{t('home.tokens')}</small></span>
                        <span className={css.homeStat}><strong>{money(activeCost?.usd ?? 0)}</strong><small>{t('home.cost')}</small></span>
                      </div>
                      {selectedMember !== undefined ? (
                        <div className={css.homeRequirements} data-member-detail>
                          <div className={css.historyHead}>
                            <strong>{selectedMember} · {t('home.memberRequirements')}</strong>
                            <button type="button" className={css.historyStartSmall} onClick={() => { setHallMember(undefined) }}>{t('home.memberBack')}</button>
                          </div>
                          <div className={css.requirementBar}><span style={{ width: (memberTasks.length === 0 ? 0 : Math.round((memberPassed / memberTasks.length) * 100)) + '%' }} /></div>
                          <span className={css.settingsMeta}>{memberPassed}/{memberTasks.length} PASS</span>
                          <table className={css.reqTable}>
                            <thead><tr><th>{t('home.colStatus')}</th><th>{t('home.memberRequirements')}</th><th>{t('home.colTask')}</th></tr></thead>
                            <tbody>
                              {shownTeam.tasks.filter(task => task.assignee === selectedMember).flatMap(task => {
                                const items = (task.acceptance ?? []).length > 0 ? (task.acceptance ?? []) : [task.subject]
                                const state = task.status === 'completed' ? 'pass' : task.status === 'failed' || task.status === 'cancelled' ? 'fail' : 'running'
                                const glyph = state === 'pass' ? '✓' : state === 'fail' ? '✕' : '▶'
                                return items.map((criterion, index) => (
                                  <tr
                                    key={task.id + '-' + index}
                                    data-status={state}
                                    data-clickable={clickable(task.assignee) || undefined}
                                    role={clickable(task.assignee) ? 'link' : undefined}
                                    tabIndex={clickable(task.assignee) ? 0 : undefined}
                                    title={clickable(task.assignee) ? t('home.openMember', { name: task.assignee }) : undefined}
                                    onClick={() => { jumpToMember(task.assignee) }}
                                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jumpToMember(task.assignee) } }}
                                  >
                                    <td><span className={css.acceptChip} data-status={state}>{glyph} {state === 'pass' ? 'PASS' : state === 'fail' ? 'FAIL' : 'RUN'}</span></td>
                                    <td>{criterion}</td>
                                    <td className={css.mono}>{task.id}</td>
                                  </tr>
                                ))
                              })}
                              {shownTeam.tasks.filter(task => task.assignee === selectedMember).length === 0 && <tr><td colSpan={3}>{t('home.noMemberTasks')}</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                      <details className={css.homeRequirements} open>
                        <summary>{t('home.requirements')} · {passedCount}/{shownTeam.tasks.length} PASS</summary>
                        <div className={css.requirementBar}><span style={{ width: (shownTeam.tasks.length === 0 ? 0 : Math.round((passedCount / shownTeam.tasks.length) * 100)) + '%' }} /></div>
                        <table className={css.reqTable}>
                          <thead><tr><th>{t('home.colStatus')}</th><th>{t('home.colTask')}</th><th>{t('home.colAssignee')}</th></tr></thead>
                          <tbody>
                            {shownTeam.tasks.map(task => {
                              const state = task.status === 'completed' ? 'pass' : task.status === 'failed' || task.status === 'cancelled' ? 'fail' : 'running'
                              const glyph = state === 'pass' ? '✓' : state === 'fail' ? '✕' : '▶'
                              return (
                                <tr
                                  key={task.id}
                                  data-status={state}
                                  data-clickable={clickable(task.assignee) || undefined}
                                  role={clickable(task.assignee) ? 'link' : undefined}
                                  tabIndex={clickable(task.assignee) ? 0 : undefined}
                                  title={clickable(task.assignee) ? t('home.openMember', { name: task.assignee }) : undefined}
                                  onClick={() => { jumpToMember(task.assignee) }}
                                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jumpToMember(task.assignee) } }}
                                >
                                  <td><span className={css.acceptChip} data-status={state}>{glyph} {state === 'pass' ? 'PASS' : state === 'fail' ? 'FAIL' : 'RUN'}</span></td>
                                  <td>{task.subject}</td>
                                  <td>{task.assignee !== '' ? task.assignee : '—'}</td>
                                </tr>
                              )
                            })}
                            {shownTeam.tasks.length === 0 && <tr><td colSpan={3}>{t('home.noRequirements')}</td></tr>}
                          </tbody>
                        </table>
                      </details>
                      )}
                    </section>
                  )}
                  <TeamSection
                    team={shownTeam}
                    t={t}
                    workspace
                  fill
                  onOpenCaptain={() => {
                    const target = shownTeam.captainSessionId !== '' ? shownTeam.captainSessionId : sessionId

                    if (openCaptain !== undefined && target !== '') openCaptain(target as SessionId)
                    // 点掌教 = 回主对话 + 回到全队需求清单。
                    setHallMember(undefined)
                    setSheet(current => current ?? 'home')
                  }}
                  onSelectMember={(name) => { setHallMember(hallMember() === name ? undefined : name) }}
                  viewingSessionId={sessionId}
                  onNavigate={(_parent, child) => { if (ownerSessionId !== undefined) openMember(ownerSessionId, child) }}
                  onContinuePlanning={() => { setSheet(undefined) }}
                  onDiscarded={() => { setSheet(undefined) }}
                />
                </>
              )
          )}
        </div>
        <MemoryModeBanner t={t} />
        <CostDialog sessionId={sessionId} t={t} />
      </aside>
    )
  }

  const tokenTitle = hasTeam
    ? `${hall.name} · ${done}/${total}`
    : `${hall.name} · ${t('office.hallNoTeam')}`

  // 侧栏宿主与右栏内内容宿主（t29）：页面内容 portal 进右栏，中间内容区不再参与。
  const sidebarHost = useHallHost(HALL_SIDEBAR_HOST)
  const contentHost = useHallHost(HALL_CONTENT_HOST)
  // 收起成 rail 时宿主仍在，只是不可见；必须连可见性一起看，否则收起后不出令牌。
  const sidebarVisible = useHallSidebarVisible()
  const activePage: HallPage | undefined = sheet === undefined ? undefined : hallPageForSheet(sheet)
  // F2：展开但福地不可见（宿主未挂载/右栏收起）时留 200ms 宽限再退回令牌，
  // 避免首帧或收起动画里「令牌 + 展开态」并存。
  const hallVisible = sidebarHost !== null && sidebarVisible
  const showToken = true
  // 展开后宿主迟迟没挂载（无会话态/宿主降级）才退回令牌兜底，首帧不再与展开态并存（F2）。
  // 同时按 t24-R2-1③：300ms 重试一次 openTab，800ms 仍未挂载就把 collapsed 落盘为 true，
  // 保证「存储说展开」和「界面是令牌」不矛盾。
  useEffect(() => {
    const visible = sidebarHost !== null && sidebarVisible
    if (collapsed || visible) {
      setHostGraceOver(false)
      // 福地可见（或已收起）即消费掉这次主动展开请求。
      pendingOpenRef.current = false
      return
    }
    if (!shouldArmHallFallback({ collapsed, hallVisible: visible })) {
      setHostGraceOver(false)
      return
    }
    const pendingOpen = pendingOpenRef.current
    const grace = window.setTimeout(() => { setHostGraceOver(true) }, 200)
    if (!pendingOpen) {
      // 被动不可见（收起成 rail / 切到没有右栏的对话）：只给令牌入口，
      // 不抢标签、不改 collapsed；点令牌时才重新展开右栏。
      return () => { window.clearTimeout(grace) }
    }
    // 宿主右栏挂载可能滞后（实测 600 宽的标签页要几百毫秒）：多点重试，且把兜底收起推后，
    // 否则会出现「右栏已展开但内容还没挂上，就被误判为不可用而收起」的空白态。
    const retryA = window.setTimeout(() => { retryOpenSidebar() }, 300)
    const retryB = window.setTimeout(() => { retryOpenSidebar() }, 900)
    const align = window.setTimeout(() => {
      console.warn('agent-teams: hall sidebar host unavailable, collapsing to token')
      setCollapsed(true)
      writeHallCollapsed(true)
    }, 2200)
    return () => { window.clearTimeout(grace); window.clearTimeout(retryA); window.clearTimeout(retryB); window.clearTimeout(align) }
    // retryOpenSidebar 只用到稳定回调，不放进依赖避免抖动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, sidebarHost, sidebarVisible, sessionId])
  const openPage = (page: HallPage): void => {
    pendingOpenRef.current = true
    setReviewing(false)
    if (page === 'gear' || page === 'progress') {
      setSheet('home')
      if (collapsed) { setCollapsed(false); writeHallCollapsed(false) }
      onOpenSidebar?.()
      return
    }
    setSheet(hallSheetForPage(page) as SheetKind)
    if (collapsed) { setCollapsed(false); writeHallCollapsed(false) }
    onOpenSidebar?.()
  }

  return (
    <>
      {showToken && createPortal((
        // 令牌常驻：悬浮显示隐藏/显示开关；隐藏态压暗，显示态恢复。
        <div
          className={css.tokenWrap}
          data-hidden={collapsed ? 'true' : undefined}
          style={{ left: tokenAt.x, top: tokenAt.y, width: tokenSize.w, height: tokenSize.h }}
        >
          <button
            type="button"
            className={css.token}
            data-hall-token
            onPointerDown={beginTokenDrag}
            onClick={(event) => { if (event.detail === 0) toggleCollapsed() }}
            aria-label={collapsed ? t('office.expand') : t('office.collapse')}
            aria-expanded={!collapsed}
            title={(collapsed ? t('office.expand') : t('office.collapse')) + ' · ' + tokenTitle}
          >
            <span className={css.tokenInner} aria-hidden>
              <span className={css.tokenBody}>
                {APP_ICON === ''
                  ? <span className={css.tokenGlyph} aria-hidden>⛩</span>
                  : <img className={css.tokenIcon} src={APP_ICON} alt="" />}
              </span>
              <span className={css.tokenTassel} aria-hidden />
            </span>
          </button>
          <button
            type="button"
            className={css.tokenToggle}
            onClick={(event) => {
              event.stopPropagation()
              if (collapsed) { bringHallBack(); return }
              setCollapsed(true)
              writeHallCollapsed(true)
              onCollapseSidebar?.()
            }}
          >
            {collapsed ? t('office.tokenShow') : t('office.tokenHide')}
          </button>
        </div>
      ), document.body)}
      {!collapsed && sidebarHost !== null && createPortal((
        <HallSidebar
          team={team}
          t={t}
          page={activePage}
          onOpenPage={openPage}
          onCollapse={toggleCollapsed}
        />
      ), sidebarHost)}
      {activePage !== undefined && contentHost !== null && createPortal(renderSheet(), contentHost)}
    </>
  )
}
