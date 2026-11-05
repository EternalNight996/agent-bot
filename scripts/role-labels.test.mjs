// Role ids stay English on the wire; every read-only surface must render the
// localized label so a Chinese session never shows "implementer" (and English
// stays English in the en dictionary).
import test from 'node:test'
import assert from 'node:assert/strict'
import { ROLE_META, roleLabel } from '../lib/client/role-labels.js'

const zh = {
  'role.label.implementer': '全栈工程师',
  'role.duty.implementer': '攻坚与实现',
  'role.label.reviewer': '技术评审',
  'role.duty.reviewer': '审查与裁断',
}
const en = {
  'role.label.implementer': 'Full-stack Engineer',
  'role.duty.implementer': 'build & fix',
  'role.label.reviewer': 'Technical Reviewer',
  'role.duty.reviewer': 'review & judge',
}
const t = (dict) => (key) => dict[key] ?? key

test('a renamed member shows its role name in the active language', () => {
  assert.equal(roleLabel('implementer', '老王', t(zh)), '全栈工程师')
  assert.equal(roleLabel('implementer', 'Wang', t(en)), 'Full-stack Engineer')
  assert.equal(roleLabel('reviewer', '阿青', t(zh)), '技术评审')
})

test('a member named after its role shows the role duty instead of repeating itself', () => {
  assert.equal(roleLabel('implementer', '全栈工程师', t(zh)), '攻坚与实现')
  assert.equal(roleLabel('reviewer', '技术评审', t(zh)), '审查与裁断')
  assert.equal(roleLabel('implementer', 'Full-stack Engineer', t(en)), 'build & fix')
})

test('a custom role falls back to the untouched wire id', () => {
  assert.equal(roleLabel('data-auditor', '老王', t(zh)), 'data-auditor')
  assert.equal(roleLabel('', '老王', t(zh)), '')
})

test('every built-in role resolves to a localized name and duty', () => {
  const dict = Object.fromEntries(ROLE_META.flatMap((role) => [
    [role.nameKey, 'N-' + role.id],
    [role.abilityKey, 'A-' + role.id],
  ]))
  for (const role of ROLE_META) {
    assert.equal(roleLabel(role.id, 'someone', t(dict)), 'N-' + role.id)
    assert.equal(roleLabel(role.id, 'N-' + role.id, t(dict)), 'A-' + role.id)
  }
})

test('role labels read the shared role catalog keys', () => {
  for (const role of ROLE_META) {
    assert.equal(role.nameKey, 'role.label.' + role.id)
    assert.equal(role.abilityKey, 'role.duty.' + role.id)
  }
})
