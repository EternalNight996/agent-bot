/**
 * Browser-safe expert role lookup: metadata only.
 *
 * The prompt bodies live in agency-role-prompts.ts and stay on the host; client
 * code that only needs a role's name, emoji, agent or executor imports here, so
 * the client bundle never carries the ~1 MB of prompt text.
 */
import { AGENCY_PREFERRED_BY_EXECUTOR, AGENCY_ROLE_SEEDS, type AgencyRoleSeed } from './agency-role-seeds.ts'

export type AgencyRole = AgencyRoleSeed
export type { AgencyRoleSeed }
export const AGENCY_ROLES: readonly AgencyRole[] = AGENCY_ROLE_SEEDS

const BY_ID = new Map(AGENCY_ROLES.map(role => [role.id, role]))

export function agencyRole(id: string): AgencyRole | undefined { return BY_ID.get(id) }

/** Pick the first selected agency role that can execute a legacy task role. */
export function agencyRoleForExecutor(executor: string, selected?: readonly string[]): AgencyRole | undefined {
  const pool = selected === undefined ? AGENCY_ROLES : selected.map(id => BY_ID.get(id)).filter((role): role is AgencyRole => role !== undefined)
  const preferred = AGENCY_PREFERRED_BY_EXECUTOR[executor]
  if (preferred !== undefined) {
    const role = pool.find(item => item.id === preferred)
    if (role !== undefined) return role
  }
  return pool.find(role => role.executor === executor) ?? pool.find(role => role.executor === 'implementer') ?? pool[0]
}
