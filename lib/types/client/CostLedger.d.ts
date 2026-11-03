import type { AgentTeamsTranslate } from './locales.ts';
export interface CostEntry {
    ts: number;
    teamId?: string;
    taskId?: string;
    memberName?: string;
    estimateUsd: number;
    mode?: string;
    decision?: string;
    inputTokens?: number;
    outputTokens?: number;
}
export interface CostReport {
    today_usd: number;
    total_usd?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    by_task: {
        taskId: string;
        usd: number;
        count: number;
        total_tokens?: number;
    }[];
    by_team: {
        teamId: string;
        usd: number;
        total_tokens?: number;
    }[];
    entries: CostEntry[];
}
declare function money(usd: number): string;
/** All-team report, used for the dropdown option totals. */
export declare function useCostReport(sessionId?: string): {
    report?: CostReport;
    reload: () => void;
};
export declare function CostDetail({ sessionId, teamId, t, createdAt, updatedAt, running }: {
    readonly sessionId?: string;
    readonly teamId?: string;
    readonly t: AgentTeamsTranslate;
    readonly createdAt?: number;
    readonly updatedAt?: number;
    readonly running?: boolean;
}): import("react").JSX.Element | null;
export { money };
