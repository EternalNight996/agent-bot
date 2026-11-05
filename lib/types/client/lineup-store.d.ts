export interface LineupEntry {
    readonly role: string;
    readonly skin: string;
}
export interface LineupDefinition {
    readonly id: string;
    readonly name: string;
    readonly entries: readonly LineupEntry[];
    readonly builtin: boolean;
}
export declare function allLineups(): LineupDefinition[];
export declare function lineupById(id: string | undefined): LineupDefinition | undefined;
export declare function createLineup(name: string): LineupDefinition | undefined;
export declare function deleteLineup(id: string): void;
export declare function setLineupEntries(id: string, entries: readonly LineupEntry[]): void;
/** 阵容人数上限：初始化与手动增员都不超过 5 人。 */
export declare const MAX_LINEUP_ENTRIES = 5;
export declare function addLineupEntry(id: string, entry: LineupEntry): void;
export declare function removeLineupEntry(id: string, index: number): void;
export declare function resetLineup(id: string): void;
export declare function useLineups(): readonly LineupDefinition[];
