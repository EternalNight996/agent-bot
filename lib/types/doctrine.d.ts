/**
 * 法脉 (doctrine): the founding workflow a sect is sworn to.
 *
 * The doctrine is a durable clarification field (not only a client template id):
 * it drives the staged task template, the member philosophy and the implicit
 * task-framing audit, so a re-clarify or a restart cannot silently change how
 * the sect delivers. legacy ids stay valid for old teams and rollback.
 */
export declare const DOCTRINE_IDS: readonly ["ship", "feat", "fix", "research", "audit", "fullstack", "hardening", "build", "array", "docs", "debate", "drama"];
export type DoctrineId = typeof DOCTRINE_IDS[number];
/** Default doctrine: direct functional delivery (功能直交). */
export declare const DEFAULT_DOCTRINE: DoctrineId;
export interface DoctrineSpec {
    readonly id: DoctrineId;
    /** Server-side Chinese name (prompts / constitution). */
    readonly name: string;
    /** One-sentence philosophy injected into the constitution and plan prompts. */
    readonly philosophy: string;
}
export declare const DOCTRINE_SPECS: Record<DoctrineId, DoctrineSpec>;
/** Is this value a stored doctrine id? */
export declare function isDoctrineId(value: unknown): value is DoctrineId;
/** Resolve a spec; unknown/missing values fall back to the direct-delivery default. */
export declare function getDoctrineSpec(value: unknown): DoctrineSpec;
/** Human label used by prompts and the constitution. */
export declare function doctrineName(value: unknown): string;
/** Philosophy block prepended to every member persona through the constitution. */
export declare function doctrinePhilosophyText(value: unknown): string;
