/**
 * Built-in skin catalog: eight pixel identities that every roster name cycles
 * through, plus a stable name→skin hash so a character keeps the same look
 * across sessions, restarts and sorted lists.
 *
 * Eight is deliberate: the config centre and the lineup editor stay scannable,
 * and 83 expert roles / 60 sect members repeat a portrait every eight slots
 * instead of asking the reader to learn seventy-odd one-off skins.
 */
import { avatarArt } from './artwork.ts'

export interface SkinDefinition {
  readonly id: string
  readonly name: string
  readonly art: string
  readonly background: string
  readonly theme: string
}

export const SKINS: readonly SkinDefinition[] = [
  { id: 'hongjun', name: '鸿钧', art: avatarArt('avatar-captain.png'), background: '#2a2418', theme: '洪荒·道祖' },
  { id: 'pangu', name: '盘古', art: avatarArt('avatar-implementer.png'), background: '#2b1d17', theme: '洪荒·开天' },
  { id: 'nuwa', name: '女娲', art: avatarArt('avatar-healer.png'), background: '#3a2430', theme: '洪荒·造人' },
  { id: 'dijun', name: '帝俊', art: avatarArt('avatar-planner.png'), background: '#2a2418', theme: '妖族·天庭' },
  { id: 'kunpeng', name: '鲲鹏', art: avatarArt('avatar-verifier.png'), background: '#102b3a', theme: '北冥·鲲鹏' },
  { id: 'tiandao', name: '天道', art: avatarArt('avatar-reviewer.png'), background: '#1d2330', theme: '天道·法轮' },
  { id: 'chiyou', name: '蚩尤', art: avatarArt('avatar-demon.png'), background: '#33151a', theme: '九黎·兵主' },
  { id: 'yangmei', name: '杨眉大仙', art: avatarArt('avatar-architect.png'), background: '#1f2f22', theme: '空心·杨柳' },
]

/** Stable FNV-1a over Unicode code points: the same name always lands on the same slot. */
function stableIndex(name: string, size: number): number {
  let hash = 0x811c9dc5
  for (const char of name) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % size
}

/** Built-in catalog. Kept as the public name so callers need no rename churn. */
export const ALL_SKINS: readonly SkinDefinition[] = SKINS

export function skinById(id: string): SkinDefinition | undefined {
  return ALL_SKINS.find(skin => skin.id === id)
}

/** The skin a roster name cycles to. Every non-empty name resolves to one of the eight. */
export function skinForName(name: string): SkinDefinition {
  return SKINS[stableIndex(name, SKINS.length)] ?? SKINS[0]!
}

/** Id of the skin a roster name cycles to; stable for a given name. */
export function skinIdForName(name: string): string {
  return skinForName(name).id
}
