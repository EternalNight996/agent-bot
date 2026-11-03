import type { TaskKind, TeamClarification, TeamRequirement, TeamState } from './types.ts';
import { type TeamMode } from './modes.ts';
import type { PlanTaskSpec } from './plan-generator.ts';
/** One built-in template: default roles and a small task DAG. */
export declare const SECT_NAMES: Record<string, string>;
export declare const ROLE_NAMES: Record<string, string>;
export interface QuickStartTemplate {
    readonly id: string;
    readonly label: string;
    readonly roles: readonly string[];
    readonly tasks: readonly {
        readonly id: string;
        readonly subject: string;
        readonly role: string;
        readonly description: string;
        /** Expected artifact/acceptance, appended to the staged task description. */
        readonly expected?: string;
        readonly dependencies?: readonly string[];
        /** Quality task kind; omitted means ordinary work. */
        readonly kind?: TaskKind;
        readonly objective?: string;
        readonly acceptance?: readonly string[];
        readonly inScope?: readonly string[];
        readonly verify?: readonly string[];
        readonly reviewedTaskId?: string;
        readonly coverageOf?: readonly string[];
    }[];
}
export declare const QUICK_START_TEMPLATES: readonly QuickStartTemplate[];
export interface QuickStartPlan {
    readonly teamName: string;
    readonly template: string;
    readonly members: readonly {
        name: string;
        role: string;
        agent?: string;
    }[];
    readonly tasks: readonly {
        id: string;
        subject: string;
        description: string;
        assignee: string;
        dependencies: string[];
        kind?: TaskKind;
        objective?: string;
        acceptance?: string[];
        inScope?: string[];
        verify?: string[];
        reviewedTaskId?: string;
        coverageOf?: string[];
    }[];
}
/** Delivery defaults inferred from the actual workspace for quality templates. */
export interface QuickStartDelivery {
    inScope: string[];
    verify: string[];
    /** Prose acceptance criteria from the constitution (merged into gate tasks). */
    acceptance?: string[];
    /** Development mode for the verifier strategy note. */
    mode?: TeamMode;
    /** Goal + interview context appended to every task description. */
    contextText?: string;
    /** Disjoint frontend/backend roots, when the workspace has recognizable layers. */
    layers?: {
        frontend: string[];
        backend: string[];
    };
    /** 阵营：决定默认队伍名与角色→角色名映射。 */
    faction?: string;
    /** 阵营角色名（鸿钧/盘古/...），任务指派人优先用这里的名字。 */
    roleNames?: Readonly<Record<string, string>>;
    /** 阵营名，用作团队名前缀。 */
    teamName?: string;
    /** 角色 -> 执行 Agent 覆盖。 */
    roleAgents?: Readonly<Record<string, string>>;
    /** 角色 -> 提示词覆盖。 */
    rolePrompts?: Readonly<Record<string, string>>;
    /** 角色 -> 旧任务执行类型。 */
    roleExecutors?: Readonly<Record<string, string>>;
}
/**
 * Infer a quality contract from the workspace instead of hardcoding src/ or pnpm test.
 * The same defaults are used by the quick-start route and by tests that build a plan
 * without a workspace (which still get a runnable, conservative contract).
 */
export declare function quickStartDeliveryDefaults(workspace: string): QuickStartDelivery;
/**
 * Prose acceptance for gate tasks: the user-confirmed criteria first, plus the
 * mode baseline only when the user explicitly picked a strong delivery mode.
 * draft (the default) never appends anything beyond the given criteria.
 */
export declare function quickStartAcceptance(criteria: readonly string[], mode: TeamMode | undefined): string[];
/** Build the staged plan a quick-start request turns into. */
export declare function buildQuickStartPlan(goal: string, templateId: string, requestedRoles?: readonly string[], delivery?: QuickStartDelivery): QuickStartPlan;
/** Order tasks so every dependency is staged before its dependents (stable). */
export declare function orderQuickStartTasks(tasks: QuickStartPlan['tasks']): QuickStartPlan['tasks'];
/** One create-task call a quick-start plan stages once the team exists. */
export interface QuickStartTaskCall {
    readonly seedId: string;
    readonly input: {
        readonly subject: string;
        readonly description: string;
        readonly assignee: string;
        /** Seed ids; the route maps them to durable task ids before calling the tool. */
        readonly dependencies: readonly string[];
        readonly kind?: TaskKind;
        readonly objective?: string;
        readonly acceptance?: readonly string[];
        readonly inScope?: readonly string[];
        readonly verify?: readonly string[];
        readonly coverageOf?: readonly string[];
        /** Seed id of the implementation this review judges. */
        readonly reviewedTaskId?: string;
    };
}
/**
 * The host plan schema only carries ordinary task fields, so quality contracts
 * are staged one create-task call at a time after the team exists.
 */
export declare function quickStartTaskCalls(plan: QuickStartPlan): QuickStartTaskCall[];
/** The host tools a quick-start staging pass needs (injectable for tests). */
export interface QuickStartTool {
    execute?: (args: unknown, exec: unknown) => Promise<unknown>;
}
export interface QuickStartTeamTools {
    create: QuickStartTool;
    createTask: QuickStartTool;
    deleteTeam?: QuickStartTool;
}
/**
 * Stage a quick-start team: create the roster first, then add every task with
 * its quality contract. The create tool's plan schema cannot carry quality
 * fields, and a half-staged team would block the next attempt, so a failure
 * after creation rolls the team back before rethrowing.
 */
export interface StageQuickStartOptions {
    /** Confirmed blocking clarification; required by the web route. */
    readonly clarification?: TeamClarification;
    /** User-confirmed requirement text (original + optional polish). */
    readonly requirement?: TeamRequirement;
}
export declare function stageQuickStartTeam(plan: QuickStartPlan, goal: string, run: unknown, tools: QuickStartTeamTools, options?: StageQuickStartOptions): Promise<{
    teamId?: string;
    teamName?: string;
    phase?: string;
}>;
/**
 * Fill each member's expert prompt body from the host catalog.
 *
 * The client bundle carries role metadata only, so a founding request sends the
 * user's overrides and nothing else. The host re-attaches the catalog prompt
 * here, which keeps team.rolePrompts byte-identical to what the browser used to
 * send while keeping ~1 MB of prompt text out of the client bundle.
 */
export declare function withRolePromptDefaults(roles: readonly string[], overrides?: Readonly<Record<string, string>>): Record<string, string>;
/** Effective roles for a founding plan (requested, else template defaults). */
export declare function quickStartRoles(templateId: string, requestedRoles?: readonly string[]): string[];
/** Build the staged plan from AI-generated task specs instead of the template. */
export declare function buildPlanFromSpecs(goal: string, templateId: string, requestedRoles: readonly string[] | undefined, specs: readonly PlanTaskSpec[], delivery?: QuickStartDelivery): QuickStartPlan;
/**
 * Map confirmed requirement items onto tasks so the library can show per-item
 * status. Existing AI coverage wins; uncovered items are distributed across
 * gate tasks in order (deterministic, every item covered).
 */
export declare function assignRequirementCoverage(tasks: QuickStartPlan['tasks'], requirements: readonly string[], goal: string): void;
/** Stored inputs a staged plan can be regenerated from. */
export interface PlanSourceView {
    readonly goal: string;
    readonly clarification: TeamClarification | null;
    readonly requirement: TeamRequirement | null;
    readonly roles: string[];
    readonly solo: boolean;
}
/** Read the regeneration source from a staged team (undefined when not staged). */
export declare function planSourceOf(team: TeamState): PlanSourceView | undefined;
/** Captain-only plan: drop the roster and route every task to the captain. */
export declare function soloPlan(plan: QuickStartPlan): QuickStartPlan;
