/**
 * 功德榜：二十三重位面境界的档案、升级指南与取经队故事。
 *
 * 境界表按「凡人级 → 仙人级 → 天尊级」三档展开，数据与文案分离：
 * 这里只放结构（境界、等级区间、档位、例子、文案 key）。
 */
import { type CultivationRealmKey } from './cultivation.ts';
import type { AgentTeamsLocaleKey } from './locales.ts';
export type AscensionTier = 'mortal' | 'immortal' | 'heaven';
/** 功德榜上的一重境界。 */
export interface AscensionRank {
    readonly realm: CultivationRealmKey;
    readonly levelMin: number;
    readonly levelMax: number;
    /** 位面等级：凡人级 / 仙人级 / 天尊级。 */
    readonly tier: AscensionTier;
    /** 该境界的代表人物/例子。 */
    readonly example: string;
    /** 该境界的一句描述（本地化 key）。 */
    readonly descKey: AgentTeamsLocaleKey;
}
/** 位面等级标题。 */
export declare const ASCENSION_TIER_KEYS: Readonly<Record<AscensionTier, AgentTeamsLocaleKey>>;
/** 由境界带推导出的完整榜文：等级区间首尾相接、覆盖 1..9999。 */
export declare const ASCENSION_RANKS: readonly AscensionRank[];
/** 快速升级的五条正路（本地化 key，按收益从高到低排）。 */
export declare const ASCENSION_TIPS: readonly AgentTeamsLocaleKey[];
/** 取经队故事：三段，从开山讲到当下。 */
export declare const ASCENSION_STORY: readonly AgentTeamsLocaleKey[];
/** 某等级落在哪一重境界（1..9999，越界夹紧）。 */
export declare function rankAtLevel(level: number): AscensionRank;
