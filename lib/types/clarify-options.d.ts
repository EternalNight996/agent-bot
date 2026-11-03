/**
 * AI-generated clarification options (module 1).
 *
 * The seven-section form structure is fixed; every option list is proposed by
 * the model from the user's requirement instead of being a hard-coded menu.
 * The static lists are only the degraded fallback when the model route is down.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type TeamMode } from './modes.ts';
import type { ReferenceDefaults } from './reference-project.ts';
import type { ClarifyOptions } from './clarify.ts';
import type { TeamRequirement } from './types.ts';
/** Static menu used only when the model cannot answer; still mode-shaped. */
export declare function fallbackClarifyOptions(mode?: TeamMode): ClarifyOptions;
export declare function buildClarifyOptionsPrompts(requirement: TeamRequirement, workspaceFacts: string, mode?: TeamMode, extras?: {
    ambition?: string;
    referenceDigest?: string;
    referenceDefaults?: ReferenceDefaults;
}): {
    system: string;
    user: string;
};
/** Parse a model reply into options; throws when it is not usable JSON. */
export declare function parseClarifyOptions(raw: string, mode?: TeamMode, referenceDefaults?: ReferenceDefaults): ClarifyOptions;
/**
 * One-shot option generation. Any failure returns the static fallback so the
 * clarification step always has selectable answers.
 */
export declare function generateClarifyOptions(ctx: Context, captain: Agent, input: {
    requirement: TeamRequirement;
    workspaceFacts: string;
    mode?: TeamMode;
    ambition?: string;
    referenceDigest?: string;
    referenceDefaults?: ReferenceDefaults;
}, signal?: AbortSignal): Promise<ClarifyOptions>;
