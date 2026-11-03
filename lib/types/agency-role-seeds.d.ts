/**
 * Expert role metadata, detached from the ~1 MB of prompt bodies so the
 * browser bundle can carry the catalog without shipping the prompts.
 * The full definitions (metadata + prompt) live in agency-catalog.ts.
 */
export interface AgencyRoleSeed {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly categoryName: string;
    readonly description: string;
    readonly emoji: string;
    readonly color: string;
    readonly skills: readonly string[];
    readonly agent: string;
    readonly executor: string;
}
/** Preferred expert for a legacy task executor. */
export declare const AGENCY_PREFERRED_BY_EXECUTOR: Readonly<Record<string, string>>;
export declare const AGENCY_ROLE_SEEDS: readonly AgencyRoleSeed[];
