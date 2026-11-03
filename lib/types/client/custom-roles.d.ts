export interface CustomRole {
    readonly id: string;
    readonly name: string;
    readonly role: string;
    /** Skin/portrait id; when omitted the base role portrait is used. */
    readonly skin?: string;
}
export declare function customRoles(): readonly CustomRole[];
export declare function addCustomRole(name: string, role: string, skin?: string): CustomRole | undefined;
export declare function removeCustomRole(id: string): void;
export declare function useCustomRoles(): readonly CustomRole[];
