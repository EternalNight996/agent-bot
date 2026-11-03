/**
 * Browser-safe expert role lookup: metadata only.
 *
 * The prompt bodies live in agency-role-prompts.ts and stay on the host; client
 * code that only needs a role's name, emoji, agent or executor imports here, so
 * the client bundle never carries the ~1 MB of prompt text.
 */
import { type AgencyRoleSeed } from './agency-role-seeds.ts';
export type AgencyRole = AgencyRoleSeed;
export type { AgencyRoleSeed };
export declare const AGENCY_ROLES: readonly AgencyRole[];
export declare function agencyRole(id: string): AgencyRole | undefined;
/** Pick the first selected agency role that can execute a legacy task role. */
export declare function agencyRoleForExecutor(executor: string, selected?: readonly string[]): AgencyRole | undefined;
