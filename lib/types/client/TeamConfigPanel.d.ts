/** Read-only configuration view: roster, routing and task contracts. */
import type { AgentTeamsTranslate } from './locales.ts';
import type { ActivityTeam } from './activity-monitor.ts';
export declare function TeamConfigPanel({ team, t, onContinue }: {
    team: ActivityTeam;
    t: AgentTeamsTranslate;
    onContinue?: () => void;
}): import("react").JSX.Element;
