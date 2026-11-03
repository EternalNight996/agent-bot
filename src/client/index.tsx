/** Browser plugin for the AgentTeams activity floater and conversation card. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the official browser locale service into ClientContext.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Conversation folding is target-neutral; keyed Chat rendering is owned by
// ui-chat, whose declaration is loaded above.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// The frame-level overlay is declared by ui-layout. This import is type-only;
// ctx.slots.inject below owns the runtime wait for the declaration.
import type { UsePanelInfo } from '@deepseek-ai/dsh-client-ui-layout/client'
// Official model catalog/directory service. The staged roster reads its
// provider/model/effort metadata without mutating the captain's own selection.
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { ActivitySurface, TEAM_TAB_ID, TEAM_TAB_KIND, WorkspaceActivity, createWorkspaceBridge } from './WorkspaceActivity.tsx'
import { getActivitySnapshotsSnapshot } from './activity-monitor.ts'
import { TeamTurnCard } from './TeamChatEntry.tsx'
import { ComposerStopButton } from './ComposerStopButton.tsx'
import { TeamQuickStart } from './QuickStartDialog.tsx'
import { createWorkspaceState } from './workspace-state.ts'
import { AgentTeamsCard, type AgentTeamsCardInjected } from './AgentTeamsCard.tsx'
import { agentTeamsCardDefinition } from './agent-teams-card-definition.ts'
import {
  AGENT_TEAMS_LOCALE_NAMESPACE, en, zh, type AgentTeamsLocaleKey,
} from './locales.ts'
import { openAgentTeamCaptain, openAgentTeamMember, type AgentTeamsLayoutNavigator, type AgentTeamsWorkspaceNavigator } from './session-navigation.ts'
import { setDirectoryPicker } from './directory-picker.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** AgentTeams conversation card and activity monitor copy. */
    agentTeams: AgentTeamsLocaleKey
  }
}

/** Required services: conversation nodes, slots, sessions navigation, and locale. */
/** t83：主视图标签被关掉后自动重开的延迟与次数上限（避免与宿主关闭操作打架）。 */
const REOPEN_DELAY_MS = 300
const REOPEN_BUDGET = 5
/** 宿主可能还没暴露 openTabs（旧版本）：结构类型 + 可选，缺失时自愈整体跳过。 */
type OpenTabsSource = {
  getSnapshot(): readonly { readonly sessionId?: string; readonly kind: string; readonly tabId?: string }[]
  subscribe(listener: () => void): () => void
}

export const inject = ['uiConversation', 'slots', 'sessions', 'locale', 'modelDirectories', 'layout']

/** The host supplies this hook for the lifetime of a 0.1.5 root slot. */
interface PanelNavigationProps {
  usePanelInfo?: UsePanelInfo
}
const useLegacyPanelInfo: UsePanelInfo = select => select({ activePanelId: null })

/** The replayed user message is the canonical transcript entry. */
function HiddenAgentTeamsCommand(): null {
  return null
}

/**
 * Register the activity monitor in the shell's additive overlay and the
 * in-conversation team card. The card's activity button re-opens a folded
 * monitor via a window event — the recovery path for an old session.
 */
export function apply(ctx: ClientContext): void {
  // 旧职责层已移除：清掉遗留的本地自定义职责，避免旧数据继续影响配置。
  try { window.localStorage.removeItem('dsh-super-agent.customDuties') } catch { /* private mode */ }
  const bridge = createWorkspaceBridge()
  const state = createWorkspaceState()
  ctx.effect(
    () => ctx.locale.register(AGENT_TEAMS_LOCALE_NAMESPACE, { zh, en }),
    'agent-teams: dictionaries',
  )
  // The founding dialog's 复刻项目 picker: the workspace UI owns the native
  // chooser (Host OS dialog / Electron bridge), so expose it through a tiny
  // module adapter instead of threading a prop through the hall surfaces.
  ctx.effect(() => {
    setDirectoryPicker(async () => {
      const service = ctx.get('uiWorkspace') as { pickDirectory?: () => Promise<string | null> } | undefined
      if (service?.pickDirectory === undefined) return null
      return await service.pickDirectory()
    })
    return () => { setDirectoryPicker(undefined) }
  }, 'agent-teams: directory picker')
  const openCaptain = (captainSessionId: SessionId): void => {
    try {
      openAgentTeamCaptain(ctx.sessions, captainSessionId, ctx.layout as AgentTeamsLayoutNavigator, ctx.get('uiWorkspace') as AgentTeamsWorkspaceNavigator | undefined)
    } catch (error: unknown) {
      console.warn(`agent-teams: failed to open captain transcript ${captainSessionId}: ${String(error)}`)
    }
  }
  const openMember = (parentId: SessionId, childId: SessionId): void => {
    void openAgentTeamMember(ctx.sessions, parentId, childId, ctx.layout as AgentTeamsLayoutNavigator, ctx.get('uiWorkspace') as AgentTeamsWorkspaceNavigator | undefined).catch((error: unknown) => {
      console.warn(`agent-teams: failed to open member transcript ${childId}: ${String(error)}`)
    })
  }
  const Panel = ({ t, usePanelInfo }: PropsLocale<'agentTeams'> & PanelNavigationProps) => {
    // A host's standard hook set is fixed for this mounted plugin instance.
    const usePanel = usePanelInfo ?? useLegacyPanelInfo
    const conversationVisible = usePanel(panel => panel.activePanelId === null)
    return (
    <ActivitySurface
      bridge={bridge}
      state={state}
      conversationVisible={conversationVisible}
      sessionsList={ctx.sessions.list}
      modelDirectories={ctx.modelDirectories}
      openMember={openMember}
      openCaptain={openCaptain}
      t={t}
    />
    )
  }
  // Optional service scope keeps legacy hosts working and removes every native
  // contribution when the host provider disappears (including HMR).
  ctx.inject(['sidebarRight', 'sidebarRightTabs'], (native) => {
    const t = native.locale.bind(AGENT_TEAMS_LOCALE_NAMESPACE)
    // t29：福地的设施页只在右栏内渲染，不再注册 keyed main 页、不调用 selectPanel。
    native.effect(() => native.sidebarRightTabs.register({
      id: TEAM_TAB_ID,
      kind: TEAM_TAB_KIND,
      title: () => t('workspace.title'),
    }))
    // 洪荒协作页常驻：宿主恢复成空布局时把「取经队协作」标签补回来；关标签这条路
    // 由下面的 close handler 直接拒绝，这里只兜底重建。只在「当前会话有队伍」时开。
    native.effect(() => {
      const source = (native.sidebarRight as unknown as { openTabs?: OpenTabsSource }).openTabs
      // 旧宿主没有 openTabs 观察点：不启用自愈，返回空清理函数保持 effect 契约。
      if (source === undefined) return () => {}
      let timer: ReturnType<typeof window.setTimeout> | undefined
      let budget = REOPEN_BUDGET
      const attempt = (): void => {
        const sessionId = native.sidebarRight.mounted.getSnapshot()
        if (sessionId === undefined) return
        if (source.getSnapshot().some(tab => tab.sessionId === sessionId && tab.kind === TEAM_TAB_KIND)) {
          budget = REOPEN_BUDGET
          return
        }
        // 无队伍的会话不主动开标签。
        const hasTeam = getActivitySnapshotsSnapshot().teams.some(team => team.captainSessionId === sessionId)
        if (!hasTeam || budget <= 0) return
        budget -= 1
        try { native.sidebarRight.openTab(TEAM_TAB_KIND) } catch { /* kind 尚未注册 */ }
      }
      const schedule = (): void => {
        if (timer !== undefined) window.clearTimeout(timer)
        timer = window.setTimeout(() => { timer = undefined; attempt() }, REOPEN_DELAY_MS)
      }
      const offTabs = source.subscribe(schedule)
      const offMounted = native.sidebarRight.mounted.subscribe(schedule)
      // 激活时先同步尝试一次：标签本来就在时不会触发 openTab。
      attempt()
      return () => {
        if (timer !== undefined) window.clearTimeout(timer)
        offTabs()
        offMounted()
      }
    })
    // 洪荒协作页「只切换、不关闭」：
    // 1) 宿主的 dock 关闭按钮由它自己渲染，插件用一条按 tabId 命中的样式把本插件标签的
    //    × 去掉（[data-dockkit-tab-close=<tabId>]），tabId 从 openTabs 观察点取；
    // 2) 快捷键/菜单仍可能触发 closeTab，宿主约定 close handler 抛错即保留标签，这里据此否决。
    native.effect(() => {
      const styleId = 'agent-teams-tab-lock'
      let style = document.getElementById(styleId) as HTMLStyleElement | null
      if (style === null) {
        style = document.createElement('style')
        style.id = styleId
        document.head.appendChild(style)
      }
      const source = (native.sidebarRight as unknown as { openTabs?: OpenTabsSource }).openTabs
      const paint = (): void => {
        const ids = [...new Set((source?.getSnapshot() ?? [])
          .filter(tab => tab.kind === TEAM_TAB_KIND && typeof tab.tabId === 'string' && tab.tabId !== '')
          .map(tab => tab.tabId as string))]
        style!.textContent = ids
          .map(id => '[data-dockkit-tab-close="' + id.replace(/["\\]/g, '\\$&') + '"]{display:none!important}')
          .join('\n')
      }
      paint()
      const off = source?.subscribe(paint)
      return () => {
        off?.()
        style?.remove()
      }
    })
    native.effect(() => {
      const register = (native.sidebarRight as unknown as {
        registerCloseHandler?: (kind: string, handler: () => void) => () => void
      }).registerCloseHandler
      // 旧宿主没有 close handler：仍然保留上面的样式隐藏与自愈。
      if (typeof register !== 'function') return () => {}
      return register.call(native.sidebarRight, TEAM_TAB_KIND, () => {
        throw new Error('agent-teams: the 洪荒协作 page is permanent; switch tabs instead of closing it')
      })
    })
    native.slots.inject('conversation.session.header.actions', () => native.slots.register({
      name: 'conversation.session.header.actions', id: 'agent-teams-create', order: 49,
      locale: AGENT_TEAMS_LOCALE_NAMESPACE,
    }, TeamQuickStart))

    native.slots.inject('conversation.chat.turnTail', () => native.slots.register({
      name: 'conversation.chat.turnTail', id: 'agent-teams-summary', order: 50,
      locale: AGENT_TEAMS_LOCALE_NAMESPACE,
      inject: () => ({ openMember }),
    }, TeamTurnCard))
    // 右侧栏的团队页：标签页本体注册在这里，浮层作为常驻福地独立存在。
    native.slots.inject('sidebar.right.pane.tab', () => {
      const dispose = native.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TEAM_TAB_ID,
        locale: AGENT_TEAMS_LOCALE_NAMESPACE,
        inject: () => ({ state, modelDirectories: native.modelDirectories, openMember }),
      }, WorkspaceActivity)
      bridge.set(native.sidebarRight)
      return () => { bridge.set(undefined); dispose() }
    })
  })

  // 对话输入区停任务按钮：官方 list 座位（与 ui-goal 同款），只叠加不占位。
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'agent-teams-preempt',
    order: 60,
    locale: AGENT_TEAMS_LOCALE_NAMESPACE,
  }, ComposerStopButton))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'agent-teams-activity',
    order: 80,
    label: 'AgentTeams activity',
    locale: AGENT_TEAMS_LOCALE_NAMESPACE,
  }, Panel))

  // The host command is only the slash-menu/admission surface. Its input is
  // replayed as the visible user message, so the generic result row would be
  // a duplicate placed before that message by command lifecycle ordering.
  ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
    name: 'conversation.chat.commandview',
    key: 'agent-teams',
  }, HiddenAgentTeamsCommand))

  ctx.uiConversation.events.register(agentTeamsCardDefinition)
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'agent-teams',
    locale: AGENT_TEAMS_LOCALE_NAMESPACE,
    inject: (): AgentTeamsCardInjected => ({
      openMember, workspaceBridge: bridge,
    }),
  }, AgentTeamsCard))
}
