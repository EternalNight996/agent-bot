/** 右侧栏 tab 类型（openTab 用）。 */
export declare const GATEWAY_TAB_KIND = "agent-teams-gateway";
/** tab 类型注册 id，也是 sidebar.right.pane.tab 的 key。 */
export declare const GATEWAY_TAB_ID = "dsh-super-agent/gateway";
/** 「展开结果」/交付完成时广播的打开事件。 */
export declare const OPEN_GATEWAY_EVENT = "agent-teams:open-gateway";
declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
    interface SidebarRightTabParamsMap {
        'agent-teams-gateway': {
            teamId?: string;
        };
    }
}
export interface GatewayTarget {
    readonly sessionId: string;
    readonly teamId?: string;
}
/** 请求在右侧栏打开驱动网关；由注册了 sidebarRight 的插件实例接住。 */
export declare function requestGateway(target: GatewayTarget): void;
/**
 * 交付自动触发的一次性闸门：返回 true 表示这次该弹，并立刻记下。
 * 存储不可用（隐私模式）时仍允许弹一次。
 */
export declare function claimGatewayAutoOpen(teamId: string): boolean;
