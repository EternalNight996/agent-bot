import type { AmbitionId } from './ambition.ts';
import type { DoctrineId } from './doctrine.ts';
import type { TeamMode } from './modes.ts';
import type { ReferenceKind } from './types.ts';
import type { ReferenceDefaults, ReferenceProfile } from './reference-project.ts';
export declare const FOUNDING_BAG_DIR = ".pixel-team";
export declare const FOUNDING_BAG_FILE = "bag.json";
/** User edits to reference-inferred defaults; always outrank the profile. */
export interface FoundingCorrections {
    platforms?: string[];
    uiStyles?: string[];
    constraints?: string[];
    memoryHints?: string[];
}
/** Last analyzed reference project, cached so a new session can reuse it. */
export interface RememberedReference {
    input: string;
    kind: ReferenceKind;
    label?: string;
    analyzedAt?: number;
    profile?: ReferenceProfile;
}
export interface FoundingBag {
    version: 1;
    doctrine?: DoctrineId;
    ambition?: AmbitionId;
    mode?: TeamMode;
    reference?: RememberedReference;
    corrections?: FoundingCorrections;
    updatedAt: number;
}
/** Validate untrusted correction payloads from the Web route. */
export declare function normalizeFoundingCorrections(value: unknown): FoundingCorrections | undefined;
/** Validate an untrusted bag object; undefined when it is unusable. */
export declare function sanitizeFoundingBag(value: unknown): FoundingBag | undefined;
/** Absolute path of this workspace's founding bag. */
export declare function foundingBagPath(workspace: string): string;
/** Read the remembered bag; missing or corrupt files read as undefined. */
export declare function readFoundingBag(workspace: string): Promise<FoundingBag | undefined>;
/** Write the bag atomically (temp file + rename). */
export declare function writeFoundingBag(workspace: string, bag: FoundingBag): Promise<FoundingBag>;
export interface FoundingPatch {
    doctrine?: DoctrineId;
    /** undefined keeps the previous ambition; null clears it (emphasis off). */
    ambition?: AmbitionId | null;
    mode?: TeamMode;
    /** undefined keeps the previous reference; null clears it. */
    reference?: RememberedReference | null;
    /** undefined keeps the previous corrections; null clears them. */
    corrections?: FoundingCorrections | null;
}
/**
 * Merge one founding decision into the remembered bag.
 * @returns the persisted bag.
 */
export declare function rememberFounding(workspace: string, patch: FoundingPatch): Promise<FoundingBag>;
/** Reference defaults after the high-priority user corrections were applied. */
export interface LayeredDefaults {
    defaults: ReferenceDefaults;
    /** Categories the user overrode ("platforms" | "uiStyles" | ...). */
    overridden: string[];
}
/**
 * Layer the user's corrections over the reference profile.
 * A corrected category REPLACES the inferred one; it is never merged back.
 */
export declare function layerReferenceDefaults(defaults: ReferenceDefaults, corrections?: FoundingCorrections): LayeredDefaults;
