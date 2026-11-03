/**
 * Client-side view of 参考项目 / 三界行囊 payloads.
 *
 * This module is pure (no React, no fetch) so the founding dialog can stay a
 * view over the host data and the layering rules are testable in isolation:
 *
 *   reference profile (low)  <  remembered corrections / current edits (high)
 */
export type ReferenceKindView = 'local' | 'github' | 'url';
export interface ReferenceDefaultsView {
    platforms: string[];
    uiStyles: string[];
    constraints: string[];
    memoryHints: string[];
    notes: string[];
    verify: string[];
}
export interface ReferenceStackView {
    languages: string[];
    uiFramework?: string;
    crossPlatform?: string;
    targets: string[];
    buildSystem?: string;
    testFramework?: string;
    packageManagers: string[];
}
export interface ReferenceHabitsView {
    readmeSections: string[];
    hasJustfile: boolean;
    justRecipes: string[];
    scripts: Record<string, string>;
    dirs: string[];
    ci: string[];
    release: string[];
}
export interface ReferenceProfileView {
    version: 1;
    input: string;
    kind: ReferenceKindView;
    label: string;
    analyzedAt: number;
    degraded?: string;
    stack: ReferenceStackView;
    habits: ReferenceHabitsView;
    inferred: ReferenceDefaultsView;
    evidence: string[];
    digest: string;
}
export interface FoundingCorrectionsView {
    platforms?: string[];
    uiStyles?: string[];
    constraints?: string[];
    memoryHints?: string[];
}
export interface RememberedReferenceView {
    input: string;
    kind: ReferenceKindView;
    label?: string;
    analyzedAt?: number;
    profile?: ReferenceProfileView;
}
export interface FoundingBagView {
    version: 1;
    doctrine?: string;
    ambition?: string;
    mode?: string;
    reference?: RememberedReferenceView;
    corrections?: FoundingCorrectionsView;
    updatedAt: number;
}
/** The reference defaults the user currently accepts (editable chips). */
export interface ReferenceSelection {
    platforms: string[];
    uiStyles: string[];
    constraints: string[];
}
/** Lenient parse of one analyzed reference profile from the host. */
export declare function asReferenceProfile(value: unknown): ReferenceProfileView | undefined;
/** Lenient parse of one inferred-defaults payload from the host. */
export declare function asReferenceDefaults(value: unknown): ReferenceDefaultsView | undefined;
/** Lenient parse of the remembered founding bag from the host. */
export declare function asFoundingBag(value: unknown): FoundingBagView | undefined;
/**
 * Reference defaults after the high-priority corrections were applied.
 * Mirrors the host's layerReferenceDefaults so the wizard shows one truth.
 */
export declare function layeredDefaults(bag: FoundingBagView | undefined): ReferenceDefaultsView | undefined;
/** Initial editable selection from layered defaults. */
export declare function selectionOf(defaults: ReferenceDefaultsView | undefined): ReferenceSelection;
/**
 * Durable clarification marker for the confirmed reference input. Only the
 * compact summary is persisted; raw files never enter team.json.
 */
export declare function referenceMarker(profile: ReferenceProfileView | undefined, input: string): {
    input: string;
    kind: ReferenceKindView;
    label?: string;
    stack?: string[];
} | undefined;
export interface ClarificationMergeInput {
    /** Mode/heuristic baseline (platforms/acceptance/excluded already set). */
    base: Record<string, unknown>;
    doctrine: string;
    /** Optional emphasis; absent when 视觉爆炸 is off. */
    ambition?: string;
    referenceInput: string;
    profile?: ReferenceProfileView;
    selection?: ReferenceSelection;
    interviewNotes: string[];
    platformAnswers: string[];
    projectKindNote: string;
}
/**
 * Merge the user's interview + reference selections into the clarification the
 * wizard submits. User selections always win; reference values are added on
 * top of the mode baseline, never replacing the user's own answers.
 */
export declare function mergeClarification(input: ClarificationMergeInput): Record<string, unknown>;
