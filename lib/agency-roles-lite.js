/**
 * Browser-safe expert role lookup: metadata only.
 *
 * The prompt bodies live in agency-role-prompts.ts and stay on the host; client
 * code that only needs a role's name, emoji, agent or executor imports here, so
 * the client bundle never carries the ~1 MB of prompt text.
 */
import { AGENCY_PREFERRED_BY_EXECUTOR, AGENCY_ROLE_SEEDS } from "./agency-role-seeds.js";
export const AGENCY_ROLES = AGENCY_ROLE_SEEDS;
const BY_ID = new Map(AGENCY_ROLES.map(role => [role.id, role]));
export function agencyRole(id) { return BY_ID.get(id); }
/** Pick the first selected agency role that can execute a legacy task role. */
export function agencyRoleForExecutor(executor, selected) {
    const pool = selected === undefined ? AGENCY_ROLES : selected.map(id => BY_ID.get(id)).filter((role) => role !== undefined);
    const preferred = AGENCY_PREFERRED_BY_EXECUTOR[executor];
    if (preferred !== undefined) {
        const role = pool.find(item => item.id === preferred);
        if (role !== undefined)
            return role;
    }
    return pool.find(role => role.executor === executor) ?? pool.find(role => role.executor === 'implementer') ?? pool[0];
}
