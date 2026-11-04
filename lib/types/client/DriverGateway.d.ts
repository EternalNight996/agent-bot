import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkspaceActivityState } from './workspace-state.ts';
export type DriverGatewayProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'agentTeams'> & {
    state: WorkspaceActivityState;
    /** 宿主 Session Remote / 插件路由的「在文件管理器中显示」；返回空串表示成功。 */
    revealPath?: (sessionId: string, teamId: string, path: string) => Promise<string>;
};
export declare function DriverGateway({ sessionId, useTabInfo, t, state, revealPath }: DriverGatewayProps): import("react").JSX.Element;
