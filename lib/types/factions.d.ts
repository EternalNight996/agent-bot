/**
 * 西游阵营构造系统（原著提取版）。
 *
 * 阵营不是皮肤包：每个阵营同时定义
 *   1) 调度拓扑（谁编排、谁并行、谁只做审计）
 *   2) 角色行为参数（自主度、预算、权限、约束）
 *   3) 视觉母题与色板
 * 组队时选择的 faction 会进入澄清/宪法，约束成员 persona 与计划生成。
 * 角色 id 必须来自现有 ROLE_META，避免发明第二套身份系统。
 */
export declare const FACTION_IDS: readonly ["pilgrim", "celestial", "buddhist", "hidden", "ancient", "primordial", "dragon", "underworld", "demon"];
export type FactionId = (typeof FACTION_IDS)[number];
export type FactionAutonomy = 'orchestrate-only' | 'very-low' | 'low' | 'medium-low' | 'medium' | 'medium-high' | 'high';
export type FactionBudget = 'minimal' | 'low' | 'medium' | 'high' | 'unlimited';
export type FactionTopology = 'single-thread' | 'layered' | 'terminal-parallel' | 'lineage' | 'transcendent' | 'primordial' | 'infrastructure' | 'audit' | 'rapid-trial';
export type FactionAudit = 'light' | 'standard' | 'strict';
export interface FactionMemberSpec {
    readonly name: string;
    readonly role: string;
    readonly duty: string;
    readonly autonomy: FactionAutonomy;
    readonly budget: FactionBudget;
    readonly permissions: readonly string[];
    readonly constraint: string;
}
export interface FactionDefinition {
    readonly id: FactionId;
    readonly name: string;
    readonly tagline: string;
    /** 原著行为逻辑（用于计划生成，不写进 UI 长文）。 */
    readonly sourceLogic: string;
    readonly topology: FactionTopology;
    readonly topologyLabel: string;
    /** 实机并行上限；缺省按 topology 推导。 */
    readonly maxParallel?: number;
    readonly audit: FactionAudit;
    readonly auditLabel: string;
    readonly parallelism: string;
    readonly motif: string;
    readonly palette: {
        readonly primary: string;
        readonly accent: string;
        readonly ink: string;
        readonly paper: string;
    };
    readonly members: readonly FactionMemberSpec[];
    /** 注入宪法的调度协议，成员 persona 会读到。 */
    readonly orchestration: string;
}
export declare const FACTIONS: readonly FactionDefinition[];
/** 实机并行上限：调度器用它限制同一时刻开放的任务数。 */
export declare function factionMaxParallel(faction: FactionDefinition): number;
export declare function isFactionId(value: unknown): value is FactionId;
export declare function factionById(id: string | undefined): FactionDefinition | undefined;
export declare function factionRoleNames(faction: FactionDefinition): Record<string, string>;
export declare function factionPrompt(faction: FactionDefinition): string;
