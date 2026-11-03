/**
 * 福地导航：设施页 key、页面宿主注册表、令牌/页面状态的 localStorage。
 *
 * 浮层窗口删除后，福地常驻右侧栏，设施页挂在宿主 main 槽（keyed）。
 * 页面宿主由侧栏/主面板组件注册 DOM 节点，福地组件把内容 portal 进去，
 * 这样状态仍集中在一个组件里（见 SIDEBAR-REQUIREMENTS.md §3、§6）。
 */
import { useSyncExternalStore } from 'react'

/** 设施页 key 前缀（队长裁决 Q4）。 */
export const HALL_PAGE_PREFIX = 'dsh-super-agent:'

/** 五张墙体设施卡对应的页面（Q4 固定命名）。 */
export const HALL_FACILITY_PAGES = ['config', 'teams', 'ranks', 'gear', 'about'] as const

/** 附属页面：设置、组队向导、进度板、收件箱、藏经阁。 */
export const HALL_EXTRA_PAGES = ['settings', 'start', 'board', 'inbox', 'library', 'progress'] as const

export type HallPage = (typeof HALL_FACILITY_PAGES)[number] | (typeof HALL_EXTRA_PAGES)[number] | 'home'

/** 主页：像素活动面板（t17：进入本插件时中间区默认落在这里）。 */
export const HALL_HOME_PAGE: HallPage = 'home'

export const HALL_PAGES: readonly HallPage[] = [...HALL_FACILITY_PAGES, ...HALL_EXTRA_PAGES, HALL_HOME_PAGE]

export function hallPageId(page: HallPage): string {
  return HALL_PAGE_PREFIX + page
}

export function hallPageFromId(id: string | null | undefined): HallPage | undefined {
  if (id === null || id === undefined || !id.startsWith(HALL_PAGE_PREFIX)) return undefined
  const rest = id.slice(HALL_PAGE_PREFIX.length)
  return (HALL_PAGES as readonly string[]).includes(rest) ? rest as HallPage : undefined
}

/** 旧面板 kind → 页面 key（天机阁在旧代码里叫 character）。 */
export function hallPageForSheet(sheet: string): HallPage | undefined {
  // 天机阁与量劫进程已移除；旧状态统一回洪荒。
  if (sheet === 'character' || sheet === 'board' || sheet === 'progress') return 'home'
  return (HALL_PAGES as readonly string[]).includes(sheet) ? sheet as HallPage : undefined
}

/** 页面 key → 旧面板 kind（渲染器仍按 sheet kind 分支）。 */
export function hallSheetForPage(page: HallPage): string {
  if (page === 'gear' || page === 'progress') return 'home'
  return page
}

const PAGE_KEY = 'dsh-super-agent.hallPage'
const COLLAPSED_KEY = 'dsh-super-agent.hallCollapsed'

export function readHallPage(): HallPage | undefined {
  if (typeof window === 'undefined') return undefined
  try { return hallPageFromId(window.localStorage.getItem(PAGE_KEY)) } catch { return undefined }
}

export function writeHallPage(page: HallPage | undefined): void {
  try {
    if (page === undefined) window.localStorage.removeItem(PAGE_KEY)
    else window.localStorage.setItem(PAGE_KEY, hallPageId(page))
  } catch { /* private mode */ }
}

/** 无记录时按「收起成令牌」处理（Q7：无记录显示令牌）。 */
export function readHallCollapsed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY)
    return raw === null ? true : raw === '1'
  } catch { return true }
}

export function writeHallCollapsed(collapsed: boolean): void {
  try { window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0') } catch { /* private mode */ }
}

/**
 * 展开态但福地不可见时，是否需要进入「令牌兜底」等待。
 *
 * 福地常驻右栏：右栏收起成 rail（面板仍挂载、只是滑出屏幕）、切换对话导致宿主
 * 卸载、或取经队页被别的标签顶掉，都必须回落成一枚令牌，否则用户既看不到福地、
 * 也点不到任何入口。收起后点令牌会重新展开右栏。
 */
export function shouldArmHallFallback(input: {
  readonly collapsed: boolean
  readonly hallVisible: boolean
}): boolean {
  return !input.collapsed && !input.hallVisible
}

/**
 * 右栏面板当前是否真的可见。
 *
 * 收起成 rail 时面板并不会卸载，只是 aria-hidden 并滑出视口；只看「宿主是否
 * 挂载」会把收起误判成可见，令牌就永远不出现。这里由宿主上报可见性。
 */
let hallSidebarVisible = true
const sidebarVisibilityListeners = new Set<() => void>()

export function setHallSidebarVisible(visible: boolean): void {
  if (hallSidebarVisible === visible) return
  hallSidebarVisible = visible
  for (const listener of sidebarVisibilityListeners) listener()
}

function subscribeSidebarVisibility(listener: () => void): () => void {
  sidebarVisibilityListeners.add(listener)
  return () => { sidebarVisibilityListeners.delete(listener) }
}

/** 右栏可见性：收起/滑出/整体隐藏都会通知福地，由它决定是否显示令牌。 */
export function useHallSidebarVisible(): boolean {
  return useSyncExternalStore(
    subscribeSidebarVisibility,
    () => hallSidebarVisible,
    () => true,
  )
}

/** 侧栏内容宿主（右侧栏标签页里渲染）。 */
export const HALL_SIDEBAR_HOST = 'hall-sidebar'

/** 右栏内设施页内容宿主（t29：页面内容只在侧栏内渲染，不再占用中间内容区）。 */
export const HALL_CONTENT_HOST = 'hall-content'


const hosts = new Map<string, HTMLElement>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function registerHallHost(key: string, node: HTMLElement | null): void {
  if (node === null) {
    if (hosts.delete(key)) notify()
    return
  }
  hosts.set(key, node)
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** 宿主节点出现/消失时触发重渲染，福地组件据此建立/撤销 portal。 */
export function useHallHost(key: string): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => hosts.get(key) ?? null, () => null)
}
