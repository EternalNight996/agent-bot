/**
 * 修炼体系：修为全局持久化，任务完成快、挂机慢；等级上限 9999。
 *
 * 这里负责“修为 -> 等级/果位/装备/技能解锁”，修为累积由 cultivation-store 负责。
 */
export declare const CULTIVATION_REALMS: readonly ["realm.qi", "realm.foundation", "realm.golden", "realm.nascent", "realm.spirit", "realm.void", "realm.integration", "realm.mahayana", "realm.tribulation", "realm.earthImmortal", "realm.heavenImmortal", "realm.trueImmortal", "realm.mysticImmortal", "realm.goldenImmortal", "realm.taiyi", "realm.daluo", "realm.quasiSaint", "realm.saint", "realm.heavenlyDao", "realm.chaos", "realm.greatDao", "realm.primordial", "realm.dao"];
export type CultivationRealmKey = (typeof CULTIVATION_REALMS)[number];
export type CultivationSkillKey = 'skill.aura' | 'skill.shield' | 'skill.swordArray' | 'skill.gale' | 'skill.law' | 'skill.swordQi' | 'skill.pillFire' | 'skill.infantFire' | 'skill.divinePower' | 'skill.domain' | 'skill.dharma' | 'skill.immortalArt' | 'skill.daoArt';
export type CultivationItemKind = 'weapon' | 'mount' | 'skill';
export interface CultivationItem {
    readonly id: string;
    readonly kind: CultivationItemKind;
    readonly level: number;
    readonly key: string;
    readonly icon: string;
    /** 坐骑对应的场景形态。 */
    readonly form?: 'auto' | 'sword' | 'beast' | 'off';
}
/** 装备物品栏：等级里程碑解锁。 */
export declare const CULTIVATION_ITEMS: readonly CultivationItem[];
/** 等级上限：9999。 */
export declare const LEVEL_CAP = 9999;
/** 果位带宽：从炼气期到神话大罗，23 重覆盖 1..9999。 */
export declare const REALM_BANDS: readonly [9, 29, 69, 149, 299, 599, 999, 1599, 2399, 3399, 4499, 5599, 6699, 7699, 8499, 9099, 9499, 9749, 9899, 9959, 9989, 9998, 9999];
/** 等级落在第几重果位（0 起，对应 CULTIVATION_REALMS）。 */
export declare function realmIndexForLevel(level: number): number;
/** 升到下一级还需要的修为（随等级线性增长）。 */
export declare function xpNeed(level: number): number;
/** 完成任务获得的修为：等级越高收益越高。 */
export declare function taskXpFor(level: number): number;
/** 师父带队完成任务获得的修为。 */
export declare function captainTaskXpFor(level: number): number;
/**
 * 每 10 秒挂机修为。
 *
 * 目标曲线：1 级正好 10 点（20 秒一级）；其余等级在加速曲线上整体减半。
 * 2 级后逐步加快，100 级约 20 秒一级（满连击），1→100 约 45 分钟；
 * 之后每级耗时按 (lv/100)^0.8 拉长（1000 级约 2 分钟、封顶约 13 分钟），越高越慢。
 */
export declare function idleXpPer10s(level: number): number;
/** 连续挂机加成：每 1 分钟 +0.5 倍，最高 3 倍（离线补结按基础值）。 */
export declare function idleStreakMultiplier(streakTicks: number): number;
export interface Cultivation {
    readonly level: number;
    readonly xp: number;
    readonly floor: number;
    readonly next: number;
    readonly ratio: number;
    readonly rankKey: CultivationRealmKey;
    readonly skills: readonly CultivationSkillKey[];
}
export declare function cultivationFromXp(xp: number): Cultivation;
export declare function memberKey(name: string): string;
export declare function captainKey(teamName: string): string;
