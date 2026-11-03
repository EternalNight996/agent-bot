import type { ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { ActivityTeam } from './activity-monitor.ts';
import type { AgentTeamsTranslate } from './locales.ts';
export declare function SectHallOverlay({ team, history, t, sessionId, modelDirectories, openMember, openCaptain, onOpenSidebar, onCollapseSidebar, }: {
    /** 无队伍时缺省：浮层仍常驻，渲染一座只有师父的空福地。 */
    readonly team?: ActivityTeam;
    /** 本师父会话下已归档的历史取经队（名册页展示）。 */
    readonly history?: readonly ActivityTeam[];
    readonly t: AgentTeamsTranslate;
    /** 当前会话；应用级浮层在个别宿主上可能拿不到，此时只能渲染空福地。 */
    readonly sessionId?: SessionId;
    readonly modelDirectories: ModelDirectoryResolver;
    readonly openMember: (parentId: SessionId, childId: SessionId) => void;
    /** 回到师父所在的主对话（点击场景里的师父）。 */
    readonly openCaptain?: (captainSessionId: SessionId) => void;
    /** 展开右侧栏并聚焦福地所在的标签页。 */
    readonly onOpenSidebar?: () => void;
    /** 收起右侧栏（回到令牌）。 */
    readonly onCollapseSidebar?: () => void;
}): import("react").JSX.Element | null;
