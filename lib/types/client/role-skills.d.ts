/** Explicit override for a role, or undefined when the catalog default applies. */
export declare function roleSkills(role: string): readonly string[] | undefined;
/** Replace a role's selected skills; an empty list clears the override. */
export declare function setRoleSkills(role: string, skills: readonly string[]): void;
export declare function useRoleSkills(): Readonly<Record<string, readonly string[]>>;
