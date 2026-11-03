/**
 * 功德榜：二十三重位面境界的档案、升级指南与取经队故事。
 *
 * 境界表按「凡人级 → 仙人级 → 天尊级」三档展开，数据与文案分离：
 * 这里只放结构（境界、等级区间、档位、例子、文案 key）。
 */
import { CULTIVATION_REALMS, REALM_BANDS, type CultivationRealmKey } from './cultivation.ts'
import type { AgentTeamsLocaleKey } from './locales.ts'

export type AscensionTier = 'mortal' | 'immortal' | 'heaven'

/** 功德榜上的一重境界。 */
export interface AscensionRank {
  readonly realm: CultivationRealmKey
  readonly levelMin: number
  readonly levelMax: number
  /** 位面等级：凡人级 / 仙人级 / 天尊级。 */
  readonly tier: AscensionTier
  /** 该境界的代表人物/例子。 */
  readonly example: string
  /** 该境界的一句描述（本地化 key）。 */
  readonly descKey: AgentTeamsLocaleKey
}

/** 位面等级标题。 */
export const ASCENSION_TIER_KEYS: Readonly<Record<AscensionTier, AgentTeamsLocaleKey>> = {
  mortal: 'rank.tier.mortal',
  immortal: 'rank.tier.immortal',
  heaven: 'rank.tier.heaven',
}

/** 每个境界的描述文案 key（显式列出，避免字符串拼接漏键）。 */
const RANK_DESC: Readonly<Record<CultivationRealmKey, AgentTeamsLocaleKey>> = {
  'realm.qi': 'rank.desc.qi',
  'realm.foundation': 'rank.desc.foundation',
  'realm.golden': 'rank.desc.golden',
  'realm.nascent': 'rank.desc.nascent',
  'realm.spirit': 'rank.desc.spirit',
  'realm.void': 'rank.desc.void',
  'realm.integration': 'rank.desc.integration',
  'realm.mahayana': 'rank.desc.mahayana',
  'realm.tribulation': 'rank.desc.tribulation',
  'realm.earthImmortal': 'rank.desc.earthImmortal',
  'realm.heavenImmortal': 'rank.desc.heavenImmortal',
  'realm.trueImmortal': 'rank.desc.trueImmortal',
  'realm.mysticImmortal': 'rank.desc.mysticImmortal',
  'realm.goldenImmortal': 'rank.desc.goldenImmortal',
  'realm.taiyi': 'rank.desc.taiyi',
  'realm.daluo': 'rank.desc.daluo',
  'realm.quasiSaint': 'rank.desc.quasiSaint',
  'realm.saint': 'rank.desc.saint',
  'realm.heavenlyDao': 'rank.desc.heavenlyDao',
  'realm.chaos': 'rank.desc.chaos',
  'realm.greatDao': 'rank.desc.greatDao',
  'realm.primordial': 'rank.desc.primordial',
  'realm.dao': 'rank.desc.dao',
}

/** 图片参考里的代表人物/例子，按境界从低到高。 */
const RANK_EXAMPLES: readonly string[] = [
  '爆楼级凡人',
  '爆街级凡人',
  '爆镇级凡人',
  '爆城级凡人',
  '爆市级凡人',
  '爆国级凡人',
  '大陆级凡人',
  '地表级凡人',
  '爆星级凡人',
  '山神土地',
  '天庭天兵',
  '四海龙王',
  '四大天王',
  '土行孙 / 雷震子',
  '金鳌岛十天君',
  '十二金仙 / 真武大帝',
  '十二祖巫 / 帝俊太一',
  '洪荒天道六圣',
  '天道鸿钧 / 杨眉大仙',
  '盘古（混沌时期）',
  '混沌大道意志',
  '鸿蒙五祖（鸿蒙时期）',
  '神话女娲 / 后土',
]

/** 由境界带推导出的完整榜文：等级区间首尾相接、覆盖 1..9999。 */
export const ASCENSION_RANKS: readonly AscensionRank[] = CULTIVATION_REALMS.map((realm, index) => ({
  realm,
  levelMin: index === 0 ? 1 : REALM_BANDS[index - 1]! + 1,
  levelMax: REALM_BANDS[index]!,
  tier: index < 9 ? 'mortal' : index < 16 ? 'immortal' : 'heaven',
  example: RANK_EXAMPLES[index] ?? '',
  descKey: RANK_DESC[realm],
}))

/** 快速升级的五条正路（本地化 key，按收益从高到低排）。 */
export const ASCENSION_TIPS: readonly AgentTeamsLocaleKey[] = [
  'ascension.tip.tasks',
  'ascension.tip.captain',
  'ascension.tip.idle',
  'ascension.tip.first',
  'ascension.tip.gear',
]

/** 取经队故事：三段，从开山讲到当下。 */
export const ASCENSION_STORY: readonly AgentTeamsLocaleKey[] = [
  'ascension.story.1',
  'ascension.story.2',
  'ascension.story.3',
]

/** 某等级落在哪一重境界（1..9999，越界夹紧）。 */
export function rankAtLevel(level: number): AscensionRank {
  const safe = Number.isFinite(level) ? Math.min(9999, Math.max(1, Math.floor(level))) : 1
  const index = REALM_BANDS.findIndex(band => safe <= band)
  return ASCENSION_RANKS[index < 0 ? ASCENSION_RANKS.length - 1 : index]!
}
