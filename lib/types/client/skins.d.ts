export interface SkinDefinition {
    readonly id: string;
    readonly name: string;
    readonly art: string;
    readonly background: string;
}
export declare const SKINS: readonly SkinDefinition[];
/** Built-in catalog. Kept as the public name so callers need no rename churn. */
export declare const ALL_SKINS: readonly SkinDefinition[];
export declare function skinById(id: string): SkinDefinition | undefined;
/** The skin a roster name cycles to. Every non-empty name resolves to one of the eight. */
export declare function skinForName(name: string): SkinDefinition;
/** Id of the skin a roster name cycles to; stable for a given name. */
export declare function skinIdForName(name: string): string;
