/**
 * 驱动网关：交付产物在右侧栏的独立视图。
 *
 * 原先的交付预览是一个全屏弹窗（ShowcasePanel），只在「所有任务都 completed」
 * 时打开，走过一轮 review 打回的队伍永远看不到。这里把它改成右侧栏的常驻
 * 页面类型：洪荒页的「展开结果」按钮与交付完成事件都通过同一个 window 事件
 * 请求打开，并按团队 id 关联内容。
 */
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

/** 右侧栏 tab 类型（openTab 用）。 */
export const GATEWAY_TAB_KIND = 'agent-teams-gateway'
/** tab 类型注册 id，也是 sidebar.right.pane.tab 的 key。 */
export const GATEWAY_TAB_ID = 'dsh-super-agent/gateway'
/** 「展开结果」/交付完成时广播的打开事件。 */
export const OPEN_GATEWAY_EVENT = 'agent-teams:open-gateway'
/** 交付自动打开只做一次，按团队记住。 */
const GATEWAY_AUTO_KEY_PREFIX = 'dsh-super-agent:gateway:auto:'

declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
  interface SidebarRightTabParamsMap {
    'agent-teams-gateway': { teamId?: string }
  }
}

export interface GatewayTarget {
  readonly sessionId: string
  readonly teamId?: string
}

/** 请求在右侧栏打开驱动网关；由注册了 sidebarRight 的插件实例接住。 */
export function requestGateway(target: GatewayTarget): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent<GatewayTarget>(OPEN_GATEWAY_EVENT, { detail: target }))
  } catch { /* 事件不可用时静默：用户仍可从右栏手动打开 */ }
}

/**
 * 交付自动触发的一次性闸门：返回 true 表示这次该弹，并立刻记下。
 * 存储不可用（隐私模式）时仍允许弹一次。
 */
export function claimGatewayAutoOpen(teamId: string): boolean {
  if (typeof window === 'undefined') return false
  const key = GATEWAY_AUTO_KEY_PREFIX + teamId
  try {
    if (window.localStorage.getItem(key) === '1') return false
    window.localStorage.setItem(key, '1')
  } catch { /* private mode: open once for this page */ }
  return true
}
