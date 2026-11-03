/**
 * Development modes: one source of truth for philosophy, default boundaries,
 * acceptance, verifier strategy, failure limits and budget.
 *
 * Every module reads this table instead of scattering mode branches.
 *
 * The founding UI only offers the three outward modes (quick experience,
 * standard delivery, strict delivery). legacy/monetize remain valid stored
 * values for old teams and advanced compatibility, but are never offered by
 * the main UI and do not contribute an acceptance baseline.
 */
export declare const TEAM_MODES: readonly ["draft", "analysis", "plan", "precision", "legacy", "compliance", "monetize"];
export type TeamMode = typeof TEAM_MODES[number];
/** The modes the founding UI offers, in experience order. */
export declare const PRIMARY_MODES: readonly ["draft", "analysis", "plan", "precision", "compliance"];
/** Default without an explicit user choice: the fast experience. */
export declare const DEFAULT_MODE: TeamMode;
export type VerifierStrategy = 'smoke' | 'unit-network' | 'legacy-regression' | 'compliance-audit';
export interface ModeSpec {
    readonly id: TeamMode;
    readonly labelKey: string;
    /** Server-side Chinese name (prompts/constitution). */
    readonly name: string;
    readonly emoji: string;
    readonly color: string;
    /** Injected at the very front of every member System Prompt. */
    readonly philosophy: string;
    readonly defaultExcluded: readonly string[];
    readonly acceptanceDefaults: readonly string[];
    /** Strict checks the user may explicitly tick on top of the defaults. */
    readonly optionalAcceptance: readonly string[];
    readonly verifier: {
        readonly strategy: VerifierStrategy;
        readonly failLimit: number;
        /** Legacy: a failing old regression suite blocks immediately. */
        readonly blockOnOldTestFail: boolean;
    };
    readonly budget: {
        readonly perTaskUsd: number;
        readonly perDayUsd: number;
        /** Retry count at which the UI asks for human triage. */
        readonly retryPromptAt: number;
    };
}
/** 开发模式是策略层：新建任务选什么模式，就按什么策略调度/审计/生成计划语法。 */
export interface ModeStrategy {
    readonly maxParallel: number;
    readonly audit: 'light' | 'standard' | 'strict';
    readonly grammar: string;
}
export declare const MODE_STRATEGIES: Record<TeamMode, ModeStrategy>;
export declare function modeStrategy(mode: TeamMode | undefined): ModeStrategy;
export declare const MODE_SPECS: Record<TeamMode, ModeSpec>;
/** Is this value one of the five stored modes? */
export declare function isTeamMode(value: unknown): value is TeamMode;
/** Main-UI equivalent for a stored/advanced mode (legacy/monetize map to standard delivery). */
export declare function primaryModeOf(mode: TeamMode | undefined): TeamMode;
/** Resolve a spec; unknown/missing values fall back to DEFAULT_MODE (draft). */
export declare function getModeSpec(mode: TeamMode | undefined): ModeSpec;
/** Default acceptance plus the mode's explicit opt-in strict checks. */
export declare function modeAcceptanceOptions(mode: TeamMode | undefined): string[];
/**
 * Only an explicit strong delivery mode contributes its acceptance baseline.
 * draft (the default) and the compatibility-only modes never append defaults.
 */
export declare function modeAddsAcceptanceBaseline(mode: TeamMode | undefined): boolean;
/** Human label for prompts and the constitution. */
export declare function modeLabel(mode: TeamMode | undefined): string;
/** The philosophy block prepended to every member persona. */
export declare function modePhilosophyText(mode: TeamMode | undefined): string;
