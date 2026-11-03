/** Expert role catalog sourced from ao.aiolaola.com/experts and agency-agents-zh. */
import { AGENCY_CATALOG, type AgencyRoleDefinition } from './agency-catalog.ts'
import { AGENCY_PREFERRED_BY_EXECUTOR } from './agency-role-seeds.ts'

export type AgencyRole = AgencyRoleDefinition
export const AGENCY_ROLES: readonly AgencyRole[] = AGENCY_CATALOG

const BY_ID = new Map(AGENCY_ROLES.map(role => [role.id, role]))

/** Preferred expert for a legacy task executor. */
const PREFERRED_BY_EXECUTOR = AGENCY_PREFERRED_BY_EXECUTOR

export function agencyRole(id: string): AgencyRole | undefined { return BY_ID.get(id) }

/** Pick the first selected agency role that can execute a legacy task role. */
export function agencyRoleForExecutor(executor: string, selected?: readonly string[]): AgencyRole | undefined {
  const pool = selected === undefined ? AGENCY_ROLES : selected.map(id => BY_ID.get(id)).filter((role): role is AgencyRole => role !== undefined)
  const preferred = PREFERRED_BY_EXECUTOR[executor]
  if (preferred !== undefined) {
    const role = pool.find(item => item.id === preferred)
    if (role !== undefined) return role
  }
  return pool.find(role => role.executor === executor) ?? pool.find(role => role.executor === 'implementer') ?? pool[0]
}
