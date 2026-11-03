/** Expert role catalog sourced from ao.aiolaola.com/experts and agency-agents-zh. */
import { type AgencyRoleDefinition } from './agency-catalog.ts';
export type AgencyRole = AgencyRoleDefinition;
export declare const AGENCY_ROLES: readonly AgencyRole[];
export declare function agencyRole(id: string): AgencyRole | undefined;
/** Pick the first selected agency role that can execute a legacy task role. */
export declare function agencyRoleForExecutor(executor: string, selected?: readonly string[]): AgencyRole | undefined;
