/**
 * 驱动网关（右侧栏页面）：把交付产物、预览与运行放进独立的右栏视图。
 *
 * 内容与队伍关联：优先用打开时带的导航参数 teamId，其次用洪荒页当前选中的
 * 队伍，最后退到该会话的第一支队伍；队伍变了，视图跟着变。
 */
import { useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ShowcaseBody } from './ShowcasePanel.tsx'
import { getActivitySnapshotsSnapshot, subscribeActivitySnapshots } from './activity-monitor.ts'
import type { WorkspaceActivityState } from './workspace-state.ts'
import css from './DriverGateway.module.css'

export type DriverGatewayProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'agentTeams'> & {
  state: WorkspaceActivityState
  /** 宿主 Session Remote / 插件路由的「在文件管理器中显示」；返回空串表示成功。 */
  revealPath?: (sessionId: string, teamId: string, path: string) => Promise<string>
}

export function DriverGateway({ sessionId, useTabInfo, t, state, revealPath }: DriverGatewayProps) {
  const { tab } = useTabInfo()
  const snapshots = useSyncExternalStore(subscribeActivitySnapshots, getActivitySnapshotsSnapshot)
  const local = useSyncExternalStore(state.subscribe, state.getSnapshot)
  const teams = [...snapshots.teams, ...snapshots.archivedTeams]
    .filter(team => team.captainSessionId === sessionId)
  const params = tab.navigation.params as { teamId?: string } | undefined
  const wanted = params?.teamId ?? local.selected.get(sessionId)
  const team = teams.find(item => item.teamId === wanted) ?? teams[0]
  if (team === undefined) {
    return <p className={css.empty}>{t('gateway.empty')}</p>
  }
  return (
    <div className={css.gateway} data-driver-gateway data-team-id={team.teamId}>
      <ShowcaseBody
        sessionId={sessionId}
        teamId={team.teamId}
        teamName={team.name}
        t={t}
        title={t('gateway.title')}
        docked
        onReveal={revealPath === undefined ? undefined : path => revealPath(sessionId, team.teamId, path)}
        onOpenWindow={(workspacePath) => {
          // 桌面端 window.open 对 dsh-app:// 会被拦截；用宿主的资源打开器在
          // 右栏新开一个文件标签，HTML 会走宿主的文档预览。
          const address = 'dsh-resource://file/session/' + encodeURIComponent(sessionId)
            + '/' + workspacePath.split('/').map(segment => encodeURIComponent(segment)).join('/')
          tab.actions.openResource(address)
        }}
      />
    </div>
  )
}
