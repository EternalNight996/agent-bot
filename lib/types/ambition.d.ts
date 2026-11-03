/**
 * 宏愿 (ambition): an OPTIONAL emphasis, off unless the user turns it on.
 *
 * It is not a development mode: modes own delivery rigor, verification and
 * budget, while an ambition only adds an emphasis to the prompts/constitution.
 * Keeping it optional is what makes it cheap — an unselected ambition injects
 * nothing anywhere. 视觉爆炸 is the only one the founding UI offers today.
 */
export declare const AMBITION_IDS: readonly ["visual", "companion", "evidence", "minimal", "growth", "developer"];
export type AmbitionId = typeof AMBITION_IDS[number];
/** The emphasis id used when the user turns the optional ambition on. */
export declare const DEFAULT_AMBITION: AmbitionId;
export interface AmbitionSpec {
    readonly id: AmbitionId;
    /** Chinese display name (UI + prompts). */
    readonly name: string;
    readonly emoji: string;
    /** One-line card description shown at founding. */
    readonly summary: string;
    /** Philosophy injected into the constitution / plan prompts. */
    readonly philosophy: string;
}
export declare const AMBITION_SPECS: Record<AmbitionId, AmbitionSpec>;
/** Is this value a stored ambition id? */
export declare function isAmbitionId(value: unknown): value is AmbitionId;
/** Resolve a spec; unknown/missing values fall back to 视觉爆炸. */
export declare function getAmbitionSpec(value: unknown): AmbitionSpec;
export declare function ambitionName(value: unknown): string;
/**
 * Philosophy block for the constitution. Empty when no ambition is selected,
 * so an off ambition costs nothing in any prompt.
 */
export declare function ambitionPhilosophyText(value: unknown): string;
