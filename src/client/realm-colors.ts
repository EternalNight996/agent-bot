/**
 * 果位配色：每跨越一重境界，等级牌换一套颜色。
 *
 * 场景里的等级牌是 canvas 画的，React 里的等级是 DOM 文本；两边共用这里的调色板，
 * 保证同一位修士在洞府/名册/装备页看到的是同一种境界色。
 */
import { realmIndexForLevel } from './cultivation.ts'

export interface RealmPalette {
  /** 等级牌边框 / 强调色。 */
  readonly border: string
  /** 等级牌底色。 */
  readonly background: string
  /** 等级文字颜色。 */
  readonly text: string
  /** 升级进度条颜色。 */
  readonly bar: string
}

/** 二十三重境界，顺序与 CULTIVATION_REALMS / REALM_BANDS 一致。 */
export const REALM_PALETTES: readonly RealmPalette[] = [
  { border: '#7fb27a', background: '#d9f2cf', text: '#22452a', bar: '#4f9a57' }, // 炼气期
  { border: '#5aab9f', background: '#d2efe9', text: '#123f3a', bar: '#2f8d80' }, // 筑基期
  { border: '#6b9ed6', background: '#d6e6f8', text: '#173a5c', bar: '#3c78b5' }, // 金丹期
  { border: '#9a7bd8', background: '#e6dcf9', text: '#332052', bar: '#6f4fb5' }, // 元婴期
  { border: '#cf77b6', background: '#f6d9ec', text: '#4a173b', bar: '#ab3f8b' }, // 化神期
  { border: '#d29452', background: '#f8e2c8', text: '#4d2c0f', bar: '#b56e22' }, // 炼虚期
  { border: '#c9a227', background: '#f7edc6', text: '#4a3a08', bar: '#a9861a' }, // 合体期
  { border: '#c96a5f', background: '#f7d9d4', text: '#4f1713', bar: '#a43a33' }, // 大乘期
  { border: '#9b4bd1', background: '#e9d9f7', text: '#3c1355', bar: '#7d2fb0' }, // 渡劫期
  { border: '#8a9a7b', background: '#e4ead9', text: '#2d3a24', bar: '#6f7f5a' }, // 普通地仙
  { border: '#6f9fd8', background: '#d9e8f7', text: '#173651', bar: '#3f7bb5' }, // 普通天仙
  { border: '#4fa9c9', background: '#d3eef7', text: '#0f3d4b', bar: '#1f8aa8' }, // 普通真仙
  { border: '#a88bd8', background: '#eadff7', text: '#3b2456', bar: '#7e5cbf' }, // 普通玄仙
  { border: '#b8911f', background: '#f5e6b0', text: '#4a3208', bar: '#9c7a12' }, // 普通金仙
  { border: '#4faa78', background: '#d5f2e2', text: '#123f2a', bar: '#2f8f60' }, // 太乙金仙
  { border: '#d07a45', background: '#f9dfcf', text: '#4d220f', bar: '#b45a22' }, // 大罗金仙
  { border: '#d4a04a', background: '#f6e7c8', text: '#4b340d', bar: '#b57e1f' }, // 混元金仙（准圣）
  { border: '#d46a6a', background: '#f7d9d9', text: '#4f1717', bar: '#b33a3a' }, // 混元大罗（圣人）
  { border: '#5fbfb0', background: '#d5f2ec', text: '#0f423b', bar: '#2f9b8a' }, // 混元太极（天道）
  { border: '#7c63c9', background: '#e3dcf8', text: '#2a1b52', bar: '#5a3fb0' }, // 混元无极（混沌）
  { border: '#a67c2e', background: '#ede0c4', text: '#3d2a0a', bar: '#7f5c18' }, // 混元至尊（大道）
  { border: '#e0b95a', background: '#f9efd0', text: '#4a3508', bar: '#c49a2a' }, // 鸿蒙至尊（鸿蒙）
  { border: '#f2c14e', background: '#2a2418', text: '#ffe9a8', bar: '#f2c14e' }, // 神话大罗（神话）
]

/** 某个等级对应的境界调色板。 */
export function realmPaletteForLevel(level: number): RealmPalette {
  return REALM_PALETTES[realmIndexForLevel(Math.max(1, Math.floor(level)))] ?? REALM_PALETTES[0]!
}
