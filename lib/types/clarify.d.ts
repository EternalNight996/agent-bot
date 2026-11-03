/**
 * Blocking requirement clarification captured before a DAG is generated.
 *
 * The wizard renders the fixed seven-section form; the captain tool accepts the
 * same object from chat. Nothing in the plan pipeline runs until this object is
 * complete and confirmed by the user.
 */
import type { ClarifyReference, TeamClarification } from './types.ts';
export declare const CLARIFY_SCALES: readonly ["small", "medium", "fullstack"];
export declare const CLARIFY_PLATFORMS: readonly ["Windows", "Linux (UOS/麒麟)", "macOS", "Android", "iOS"];
export declare const CLARIFY_UI_STYLES: readonly ["工业极简", "桌面端传统", "移动端触控优先", "科技感大屏"];
export declare const DEFAULT_EXCLUDED: readonly ["不改 MES 接口", "不升级操作系统", "不引入云服务"];
/**
 * AI-proposed answers for the clarification form. The section structure stays
 * fixed; these lists are tailored to the requirement by the model.
 */
export interface ClarifyOptions {
    readonly source: 'ai' | 'fallback';
    readonly type: 'hardware' | 'software';
    readonly scale: 'small' | 'medium' | 'fullstack';
    readonly ui: {
        readonly references: string[];
        readonly styles: string[];
        readonly notes: string[];
    };
    readonly platforms: string[];
    readonly hardware: string[];
    readonly constraints: string[];
    readonly excluded: string[];
    readonly acceptance: string[];
    readonly memoryHints: string[];
}
/**
 * Validate the durable reference-project marker. The raw input is capped so a
 * pasted file dump can never bloat team.json or the constitution.
 */
export declare function normalizeClarifyReference(value: unknown): ClarifyReference | undefined;
/** Validate and normalize one clarification payload from the UI or a tool call. */
export declare function normalizeClarification(value: unknown): TeamClarification;
/** Render the fixed seven-section clarification form the user confirmed. */
export declare function describeClarification(clarification: TeamClarification): string;
