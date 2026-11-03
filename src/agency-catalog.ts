/** Full expert catalog distilled from ao.aiolaola.com/experts and agency-agents-zh. */
import { AGENCY_ROLE_SEEDS, type AgencyRoleSeed } from './agency-role-seeds.ts'
import { AGENCY_ROLE_PROMPTS } from './agency-role-prompts.ts'

export type { AgencyRoleSeed }

export interface AgencyRoleDefinition extends AgencyRoleSeed {
  readonly prompt: string
}

/** Metadata joined with its prompt body; the host composes this lazily per role. */
export const AGENCY_CATALOG: readonly AgencyRoleDefinition[] = AGENCY_ROLE_SEEDS.map(seed => ({
  ...seed,
  prompt: AGENCY_ROLE_PROMPTS[seed.id] ?? '',
}))
