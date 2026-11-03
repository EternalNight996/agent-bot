export interface CustomAgencyRole {
    readonly id: string;
    readonly name: string;
    readonly category: 'product' | 'design' | 'engineering' | 'testing' | 'delivery';
    readonly skills: readonly string[];
    readonly executor: string;
    readonly agent: string;
    readonly prompt: string;
}
export declare function addCustomAgencyRole(input: Omit<CustomAgencyRole, 'id'>): CustomAgencyRole | undefined;
export declare function removeCustomAgencyRole(id: string): void;
export declare function useCustomAgencyRoles(): readonly CustomAgencyRole[];
