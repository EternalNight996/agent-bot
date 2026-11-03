import type { TaskFraming, TeamClarification } from './types.ts';
export declare const FRAMING_DIR = ".pixel-team";
type GoalKind = TaskFraming['goalKind'];
/** Deterministic goal classification used by the framing audit. */
export declare function classifyGoal(goal: string): {
    goalKind: GoalKind;
    signals: string[];
};
/** Frame one founding request. Pure and deterministic. */
export declare function frameFounding(input: {
    goal: string;
    clarification: TeamClarification;
    /** Explicit doctrine; falls back to the clarification field then 功能直交. */
    doctrine?: string;
    at?: number;
}): TaskFraming;
/** Workspace-relative audit path for one team. */
export declare function framingRelativePath(project: string): string;
/** Write the human-auditable framing record next to the constitution. */
export declare function writeFramingAudit(workspace: string, project: string, framing: TaskFraming): Promise<string>;
export {};
