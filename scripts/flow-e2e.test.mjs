import assert from 'node:assert/strict'
import test from 'node:test'
import { AGENCY_ROLES, agencyRole, agencyRoleForExecutor } from '../lib/agency-roles.js'
import { ALL_SKINS, skinById, skinIdForName, SKINS } from '../lib/client/skins.js'
import { allLineups } from '../lib/client/lineup-store.js'
import { buildQuickStartPlan } from '../lib/quick-start.js'
import { memberPersona } from '../lib/members.js'

test('catalog and skins are complete', () => {
  assert.ok(AGENCY_ROLES.length >= 80)
  assert.equal(new Set(AGENCY_ROLES.map(role => role.id)).size, AGENCY_ROLES.length)
  // Eight built-in skins cycle across the roster; every one must carry art.
  assert.equal(SKINS.length, 8)
  assert.equal(ALL_SKINS.length, 8)
  for (const skin of ALL_SKINS) assert.ok(skin.art !== '', skin.name + ' must have art')
  // Any roster or expert name resolves to one of the eight, deterministically.
  for (const name of ['盘古', '饕餮', '鸿钧', '无名之辈']) {
    const first = skinIdForName(name)
    assert.ok(ALL_SKINS.some(skin => skin.id === first), name + ' must map to a catalog skin')
    assert.equal(skinIdForName(name), first, 'name→skin mapping must be stable')
  }
})

test('initial lineups keep only the essential five seats', () => {
  for (const lineup of allLineups()) {
    assert.equal(lineup.entries.length, 5, lineup.name + ' must start with five seats')
    assert.deepEqual(lineup.entries.map(entry => entry.role).sort(), [
      'product-manager', 'engineering-code-reviewer', 'engineering-senior-developer', 'testing-evidence-collector', 'design-ui-designer',
    ].sort(), lineup.name + ' must keep the essential roles')
  }
})

test('lineup -> role -> skin -> agent -> plan is a closed loop', () => {
  const lineup = allLineups()[0]
  const roles = lineup.entries.map(entry => entry.role)
  const roleNames = Object.fromEntries(lineup.entries.map(entry => [entry.role, skinById(entry.skin)?.name ?? entry.skin]))
  const roleAgents = Object.fromEntries(roles.map(role => [role, agencyRole(role)?.agent ?? 'dsh']))
  const plan = buildQuickStartPlan('做一个带完整视觉 UI 的产品并交付', 'feat', roles, {
    inScope: ['src/'], verify: ['git diff --check'], roleNames, roleAgents,
    teamName: lineup.name, mode: 'precision', acceptance: ['主流程跑通'],
  })
  assert.ok(plan.teamName.startsWith(lineup.name + '·'))
  assert.equal(plan.members.length, roles.length)
  for (const member of plan.members) {
    assert.ok(roles.includes(member.role), member.role)
    assert.equal(member.name, roleNames[member.role])
    assert.equal(member.agent, roleAgents[member.role])
  }
  const names = new Set(plan.members.map(member => member.name))
  for (const task of plan.tasks) assert.ok(names.has(task.assignee), task.id + ' assignee must exist')
  // Legacy task executors are mapped to the selected agency roles.
  assert.equal(plan.tasks.find(task => task.id === 'impl')?.assignee, roleNames['engineering-senior-developer'])
  assert.equal(plan.tasks.find(task => task.id === 'review')?.assignee, roleNames['engineering-code-reviewer'])
})

test('role prompt overrides reach the member persona', () => {
  const role = 'engineering-senior-developer'
  const team = {
    name: '完整流程', id: 'flow', captainSessionId: 'captain', createdAt: 0,
    members: [{ name: '盘古', role }], tasks: [], taskSeq: 0,
    rolePrompts: { [role]: 'FLOW_PROMPT_MARKER：先画 UI 再实现。' },
  }
  const persona = memberPersona(team, team.members[0], '.agent-teams', '')
  assert.ok(persona.includes('FLOW_PROMPT_MARKER'))
  assert.equal(agencyRoleForExecutor('frontend')?.id, 'engineering-frontend-developer')
  assert.equal(agencyRole('product-manager')?.executor, 'planner')
})
