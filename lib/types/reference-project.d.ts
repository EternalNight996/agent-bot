import type { ClarifyReference, ReferenceKind } from './types.ts';
/** One normalized reference input. */
export interface ReferenceTarget {
    /** Exactly what the user typed. */
    readonly input: string;
    readonly kind: ReferenceKind;
    /** Short human label (repo, directory or page title). */
    readonly label: string;
    /** Local absolute path, `owner/repo`, or URL. */
    readonly locator: string;
}
export interface ReferenceStack {
    languages: string[];
    uiFramework?: string;
    crossPlatform?: string;
    targets: string[];
    buildSystem?: string;
    testFramework?: string;
    packageManagers: string[];
}
export interface ReferenceHabits {
    readmeSections: string[];
    hasJustfile: boolean;
    justRecipes: string[];
    /** package.json scripts (name -> command), capped. */
    scripts: Record<string, string>;
    dirs: string[];
    /** CI workflow file names. */
    ci: string[];
    /** Release/build wiring observed (tauri.conf.json, release scripts, workflows). */
    release: string[];
}
export interface ReferenceDefaults {
    platforms: string[];
    uiStyles: string[];
    constraints: string[];
    memoryHints: string[];
    notes: string[];
    verify: string[];
}
export interface ReferenceProfile {
    version: 1;
    input: string;
    kind: ReferenceKind;
    label: string;
    analyzedAt: number;
    /** Present when part of the analysis failed (still usable, just thinner). */
    degraded?: string;
    stack: ReferenceStack;
    habits: ReferenceHabits;
    inferred: ReferenceDefaults;
    /** Files/signals that produced this profile, for audit. */
    evidence: string[];
    /** Compact prompt text (never the raw file dump). */
    digest: string;
}
type FetchLike = typeof globalThis.fetch;
/** Classify one raw reference input. Unknown shapes degrade to a local path. */
export declare function classifyReference(raw: string, workspace: string): ReferenceTarget | undefined;
/** Compact prompt text; capped so a huge README can never flood a prompt. */
export declare function referenceDigest(profile: ReferenceProfile): string;
/** Durable marker persisted on the clarification / constitution. */
export declare function clarifyReferenceOf(profile: ReferenceProfile): ClarifyReference;
/** Analyze one reference input. Local paths must exist; network sources degrade. */
export declare function analyzeReference(workspace: string, raw: string | ReferenceTarget, deps?: {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
}): Promise<ReferenceProfile>;
export {};
