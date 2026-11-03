/** Full expert catalog distilled from ao.aiolaola.com/experts and agency-agents-zh. */
import { type AgencyRoleSeed } from './agency-role-seeds.ts';
export type { AgencyRoleSeed };
export interface AgencyRoleDefinition extends AgencyRoleSeed {
    readonly prompt: string;
}
/** Metadata joined with its prompt body; the host composes this lazily per role. */
export declare const AGENCY_CATALOG: readonly AgencyRoleDefinition[];
