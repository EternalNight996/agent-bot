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
import { DriverGateway } from './DriverGateway.tsx'
import { GATEWAY_TAB_ID, GATEWAY_TAB_KIND, OPEN_GATEWAY_EVENT, type GatewayTarget } from './gateway.ts'
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
  // 宿主的 open/reveal 是 Session Remote 服务：必须用 ctx.inject 声明依赖后才能取到
  // （直接 ctx.get('remote.session') 会被 cordis 拒绝）。服务缺失时保持 undefined，
  // 由插件自己的服务端路由兜底。
  let hostOpenWorkspacePath: ((request: { path: string; action: 'open' | 'reveal' }) => Promise<{ ok?: boolean; error?: { code?: string; message?: string } }>) | undefined
  ctx.inject(['remote', 'remote.session'], (scoped) => {
    const remote = (scoped as unknown as {
      remote?: {
        session?: {
          openWorkspacePath?: (request: { path: string; action: 'open' | 'reveal' }) => Promise<{ ok?: boolean; error?: { code?: string; message?: string } }>
        }
      }
    }).remote
    const opener = remote?.session?.openWorkspacePath
    if (typeof opener === 'function') {
      hostOpenWorkspacePath = request => opener.call(remote!.session, request)
    }
    return () => { hostOpenWorkspacePath = undefined }
  })
  // 「打开目标文件夹」走宿主的 Session Remote（与文件标签里的 reveal 同一路径），
  // 不自己起服务端路由：客户端热更新即可生效。
  const revealWorkspacePath = async (sessionId: string, teamId: string, path: string): Promise<string> => {
    // 首选宿主 Session Remote（与文件标签的 open/reveal 同一条链路）。
    let reason = ''
    try {
      const summary = ctx.sessions.list.getSnapshot().byId[sessionId as SessionId]
      const cwd = summary?.cwd
      const absolute = cwd === undefined || cwd === ''
        ? path
        : cwd.includes('\\')
          ? cwd.replace(/[\\/]+$/, '') + '\\' + path.replaceAll('/', '\\')
          : cwd.replace(/\/+$/, '') + '/' + path
      const opener = hostOpenWorkspacePath
      if (opener === undefined) {
        reason = 'host remote unavailable'
      } else {
        const result = await opener({ path: absolute, action: 'reveal' })
        if (result?.ok === true) return ''
        reason = 'remote rejected: ' + (result?.error?.code ?? result?.error?.message ?? 'unknown')
      }
    } catch (error) {
      reason = 'remote error: ' + (error instanceof Error ? error.message : String(error))
    }
    // 宿主拒绝时用插件路由兜底：服务端校验产物路径后交给系统文件管理器。
    try {
      const response = await fetch('/plugins/dsh-super-agent/reveal-artifact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, teamId, path }),
      })
      if (response.status === 404) return '需要重启一次应用，让新的服务端路由加载'
      if (!response.ok) return reason + ' / plugin route HTTP ' + response.status
      const body = await response.json() as { ok?: boolean }
      return body.ok === true ? '' : reason + ' / plugin route rejected'
    } catch (error) {
      return reason + ' / plugin route error: ' + (error instanceof Error ? error.message : String(error))
    }
  }
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
    // 洪荒协作可关闭，但保留一个 guide 入口，关掉后仍能从右栏「开始」页重新打开。
    native.effect(() => native.sidebarRightTabs.register({
      id: TEAM_TAB_ID,
      kind: TEAM_TAB_KIND,
      title: () => t('workspace.title'),
      guide: [{
        id: 'agent-teams-workspace',
        order: 20,
        title: () => t('workspace.title'),
        description: () => t('workspace.guideHint'),
      }],
    }))
    // 驱动网关同样是普通可关标签：交付结果看够了就关，需要时用「展开结果」或交付
    // 自动打开重新拉起，不再做「隐藏 × + 拒绝关闭」的常驻锁定。
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
    // 驱动网关：交付产物的右栏独立视图。注册类型 + body，并接住「展开结果」
    // 与「交付自动打开」的 window 事件；内容按 teamId 关联到对应交付。
    native.effect(() => native.sidebarRightTabs.register({
      id: GATEWAY_TAB_ID,
      kind: GATEWAY_TAB_KIND,
      title: () => t('gateway.title'),
    }))
    native.slots.inject('sidebar.right.pane.tab', () => native.slots.register({
      name: 'sidebar.right.pane.tab',
      key: GATEWAY_TAB_ID,
      locale: AGENT_TEAMS_LOCALE_NAMESPACE,
      inject: () => ({ state, revealPath: revealWorkspacePath }),
    }, DriverGateway))
    native.effect(() => {
      const timers = new Set<number>()
      /**
       * 刚创建的标签页宿主只把它摆进栏里，不保证切换过去（第一次点「展开结果」常见：
       * 标签出现了，视图还停在洪荒页）。开完再显式 focus 一次，并用 rAF 兜住 store 提交延迟。
       */
      const focusGateway = (sessionId: string): void => {
        const source = (native.sidebarRight as unknown as {
          openTabs?: { getSnapshot(): readonly { readonly sessionId?: string; readonly kind: string; readonly tabId?: string }[] }
        }).openTabs
        const record = source?.getSnapshot().find(tab =>
          tab.sessionId === sessionId && tab.kind === GATEWAY_TAB_KIND && typeof tab.tabId === 'string' && tab.tabId !== '')
        if (record?.tabId === undefined) return
        try {
          native.sidebarRight.focus(record.tabId)
        } catch { /* tab disappeared between listing and focus */ }
      }
      /** 右栏只对「屏上会话」执行命令：命中就开标签，未命中把原因留给调用方。 */
      const tryOpen = (detail: GatewayTarget): boolean => {
        if (native.sidebarRight.mounted.getSnapshot() !== detail.sessionId) return false
        try {
          native.sidebarRight.openTab(GATEWAY_TAB_KIND, { params: { teamId: detail.teamId } })
          focusGateway(detail.sessionId)
          window.requestAnimationFrame(() => { focusGateway(detail.sessionId) })
          return true
        } catch (error: unknown) {
          // 不再静默：kind 未注册 / 无座席时这里必须留下痕迹，否则用户只看到“点了没反应”。
          console.warn('agent-teams: failed to open the driver gateway tab', error)
          return false
        }
      }
      const open = (event: Event): void => {
        const detail = (event as CustomEvent<GatewayTarget>).detail
        if (detail?.sessionId === undefined) return
        if (tryOpen(detail)) return
        // 「展开结果」可能点在别的会话的队伍上，或主栏正被全局面板占住（此时宿主把
        // mounted 报成 undefined）。先导航回该队伍的主会话并退出面板，等 mounted 追上来
        // 再开右栏标签；轮询有上限，避免一直挂着。
        openCaptain(detail.sessionId as SessionId)
        let tries = 0
        const timer = window.setInterval(() => {
          tries += 1
          if (tryOpen(detail)) {
            window.clearInterval(timer)
            timers.delete(timer)
            return
          }
          if (tries >= 40) {
            // 会话始终没有变成屏上会话（切不过去，或宿主没跟上）：留下一条可查的痕迹。
            console.warn('agent-teams: gave up opening the driver gateway; the team session never became the on-screen session', detail)
            window.clearInterval(timer)
            timers.delete(timer)
          }
        }, 120)
        timers.add(timer)
      }
      window.addEventListener(OPEN_GATEWAY_EVENT, open)
      return () => {
        window.removeEventListener(OPEN_GATEWAY_EVENT, open)
        for (const timer of timers) window.clearInterval(timer)
        timers.clear()
      }
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
