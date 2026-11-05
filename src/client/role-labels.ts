/**
 * Display-only role labels.
 *
 * The role id is the wire value (tool arguments, plan APIs, task policies) and
 * must never be translated before it leaves the UI; every surface renders
 * `roleLabel()` instead so a Chinese session never leaks `implementer`.
 * Members staged by the quick-start dialog are named after their role, so the
 * label falls back to the role's duty there and the row does not repeat one word
 * twice; a renamed member still shows which role it holds.
 *
 * The copy itself lives in the shared `role.label.*` / `role.duty.*` keys so
 * the role catalog and the pixel hall cannot drift apart.
 */
import type { AgentTeamsLocaleKey, AgentTeamsTranslate } from './locales.ts'
import { ROLE_IDS } from './role-catalog.ts'

export interface RoleLabelMeta {
  readonly id: string
  readonly nameKey: AgentTeamsLocaleKey
  readonly abilityKey: AgentTeamsLocaleKey
}

/** Built-in roles, in picker order (the captain has its own skin copy). */
export const ROLE_META: readonly RoleLabelMeta[] = ROLE_IDS
  .filter(id => id !== 'captain')
  .map(id => ({
    id,
    nameKey: ('role.label.' + id) as AgentTeamsLocaleKey,
    abilityKey: ('role.duty.' + id) as AgentTeamsLocaleKey,
  }))

const ROLE_INDEX: ReadonlyMap<string, RoleLabelMeta> = new Map(ROLE_META.map(role => [role.id, role]))

/**
 * Localized label for one role id.
 * @param id - the wire role id (for example `implementer`).
 * @param memberName - the member's display name, used to avoid repeating the
 *   role word for members that were named after their role.
 * @param t - the AgentTeams translator.
 * @returns the localized role name, the role's duty when the name already is
 *   that name, or the untouched id for a custom role.
 */
export function roleLabel(id: string, memberName: string, t: AgentTeamsTranslate): string {
  const meta = ROLE_INDEX.get(id)
  if (meta === undefined) return id
  const name = t(meta.nameKey)
  return memberName.trim() === name ? t(meta.abilityKey) : name
}
