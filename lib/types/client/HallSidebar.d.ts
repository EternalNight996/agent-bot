import type { ActivityTeam } from './activity-monitor.ts';
import type { AgentTeamsTranslate } from './locales.ts';
import { type HallPage } from './hall-nav.ts';
export interface HallSidebarProps {
    readonly team?: ActivityTeam;
    readonly t: AgentTeamsTranslate;
    readonly page?: HallPage;
    readonly onOpenPage: (page: HallPage) => void;
    readonly onCollapse: () => void;
}
export declare function HallSidebar({ team, t, page, onOpenPage, onCollapse }: HallSidebarProps): import("react").JSX.Element;
