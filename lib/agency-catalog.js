/** Full expert catalog distilled from ao.aiolaola.com/experts and agency-agents-zh. */
import { AGENCY_ROLE_SEEDS } from "./agency-role-seeds.js";
import { AGENCY_ROLE_PROMPTS } from "./agency-role-prompts.js";
/** Metadata joined with its prompt body; the host composes this lazily per role. */
export const AGENCY_CATALOG = AGENCY_ROLE_SEEDS.map(seed => ({
    ...seed,
    prompt: AGENCY_ROLE_PROMPTS[seed.id] ?? '',
}));
