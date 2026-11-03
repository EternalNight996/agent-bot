import type { AgentTeamsLocaleKey } from './locales.ts';
export type Translate = (key: AgentTeamsLocaleKey) => string;
/** Modern software-team duties; these are prompt roles, not pixel characters. */
export declare const ROLE_IDS: readonly ["planner", "implementer", "verifier", "reviewer", "analyst", "operator", "documenter", "architect", "integrator", "auditor", "tester", "security", "frontend", "backend", "writer", "researcher", "healer", "talisman", "beastmaster", "puppeteer", "musician", "poisoner", "monk", "demon", "captain"];
/** Localized duty name with the raw role id as fallback for custom roles. */
export declare function roleLabel(role: string, t: Translate): string;
/** Localized default work description for a duty. */
export declare function roleDuty(role: string, t: Translate): string;
/** Translate the common permission tokens; unknown Chinese tokens stay verbatim. */
export declare function permissionLabel(permission: string, zh: boolean): string;
export interface RolePromptInput {
    readonly name: string;
    readonly role: string;
    readonly autonomy: string;
    readonly budget: string;
    readonly permissions: readonly string[];
    readonly constraint: string;
}
/** A short, human-readable preview of the persona shown in the role settings page. */
export declare function rolePrompt(input: RolePromptInput, t: Translate, zh: boolean): string;
