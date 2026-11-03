import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { FACTIONS, FACTION_IDS, factionById, factionMaxParallel, factionPrompt, factionRoleNames } from '../lib/factions.js'
import { ROLE_META } from '../lib/client/role-labels.js'
import { buildQuickStartPlan } from '../lib/quick-start.js'
import { normalizeClarification, describeClarification } from '../lib/clarify.js'
import { modeStrategy } from '../lib/modes.js'

const ROLE_IDS = new Set(ROLE_META.map(role => role.id))

test('nine factions define topology, audit, behavior and a visual motif', () => {
  assert.equal(FACTIONS.length, 9)
  assert.deepEqual(FACTIONS.map(faction => faction.id), [...FACTION_IDS])
  for (const faction of FACTIONS) {
    assert.ok(faction.name.length > 0)
    assert.ok(faction.topologyLabel.length > 0)
    assert.ok(faction.auditLabel.length > 0)
    assert.ok(faction.parallelism.length > 0)
    assert.ok(faction.motif.length > 0)
    assert.equal(faction.palette.primary.length, 7)
    assert.ok(faction.members.length >= 5, faction.id + ' needs a usable roster')
    assert.ok(faction.orchestration.includes('调度拓扑'), faction.id + ' must declare a topology')
    for (const member of faction.members) {
      assert.ok(ROLE_IDS.has(member.role), faction.id + ' uses unknown role ' + member.role)
      assert.ok(member.duty.length > 0)
      assert.ok(member.permissions.length > 0)
      assert.ok(member.constraint.length > 0)
    }
    const roles = new Set(faction.members.map(member => member.role))
    for (const core of ['planner', 'implementer', 'verifier', 'reviewer']) {
      assert.ok(roles.has(core), faction.id + ' must cover core role ' + core)
    }
    const names = faction.members.map(member => member.name)
    assert.equal(new Set(names).size, names.length, faction.id + ' member names must be unique')
  }
})

test('faction topology stays descriptive; the mode owns the runtime cap', () => {
  assert.equal(factionMaxParallel(factionById('pilgrim')), 1)
  assert.equal(factionMaxParallel(factionById('hidden')), 1)
  assert.equal(factionMaxParallel(factionById('celestial')), 4)
  assert.equal(factionMaxParallel(factionById('ancient')), 2)
  assert.equal(factionMaxParallel(factionById('primordial')), 4)
  assert.equal(factionMaxParallel(factionById('demon')), 3)
})

test('the captain skin defaults to Tang Monk and is switchable in settings', () => {
  const skin = readFileSync(new URL('../src/client/captain-skin.ts', import.meta.url), 'utf8')
  const artwork = readFileSync(new URL('../src/client/artwork.ts', import.meta.url), 'utf8')
  const hall = readFileSync(new URL('../src/client/ConfigCenter.tsx', import.meta.url), 'utf8')
  assert.match(artwork, /DEFAULT_CAPTAIN_SKIN: CaptainSkinId = 'hongjun'/)
  assert.match(artwork, /hongjun: \{ name: '鸿钧/)
  assert.match(skin, /dsh-super-agent\.captainSkin/)
  assert.match(skin, /setCaptainSkin/)
  assert.match(hall, /captain-skins/)
  assert.match(hall, /setCaptainSkin\(option\.id\)/)
})

test('the faction preference is global; the mode owns runtime strategy', () => {
  const dialog = readFileSync(new URL('../src/client/QuickStartDialog.tsx', import.meta.url), 'utf8')
  const scheduler = readFileSync(new URL('../src/scheduler.ts', import.meta.url), 'utf8')
  assert.match(dialog, /dsh-super-agent\.lastFaction/)
  assert.match(dialog, /readLastFaction\(\)/)
  assert.match(dialog, /writeLastFaction\(id\)/)
  assert.match(dialog, /const defaultFaction = lastFaction/, 'a fresh session falls back to the last visible lineup')
  assert.match(scheduler, /modeStrategy\(fresh\.clarification\?\.mode\)\.maxParallel/)
  assert.match(scheduler, /openCount >= modeStrategy/)
  assert.equal(modeStrategy('draft').maxParallel, 4)
  assert.equal(modeStrategy('compliance').maxParallel, 1)
})

test('faction prompts carry every member behavior parameter', () => {
  const faction = factionById('celestial')
  assert.ok(faction !== undefined)
  const prompt = factionPrompt(faction)
  for (const member of faction.members) {
    assert.ok(prompt.includes(member.name), 'prompt must name ' + member.name)
    assert.ok(prompt.includes(member.autonomy), 'prompt must carry autonomy for ' + member.name)
  }
})

test('a founding plan uses the faction cast names and team name', () => {
  const faction = factionById('pilgrim')
  assert.ok(faction !== undefined)
  const roleNames = factionRoleNames(faction)
  const plan = buildQuickStartPlan('build a demo', 'feat', faction.members.map(member => member.role), {
    inScope: ['projects/demo/'],
    verify: ['node --check demo.js'],
    roleNames,
    teamName: faction.name,
  })
  assert.ok(plan.teamName.startsWith('紫霄宫·'))
  assert.ok(plan.members.some(member => member.name === '鸿钧'))
  assert.ok(plan.members.some(member => member.name === '盘古'))
  const impl = plan.tasks.find(task => task.id === 'impl')
  assert.equal(impl?.assignee, '盘古')
  const review = plan.tasks.find(task => task.id === 'review')
  assert.equal(review?.assignee, '天道')
})

test('the clarification carries a valid faction and drops unknown ids', () => {
  const base = {
    type: 'software', scale: 'small', mode: 'draft', faction: 'celestial',
    ui: {}, platforms: ['Windows'], hardwareList: [], constraints: [], excluded: [],
    acceptance: ['main flow works'], memoryHints: [],
  }
  const clarified = normalizeClarification(base)
  assert.equal(clarified.faction, 'celestial')
  assert.ok(describeClarification(clarified).includes('【阵营皮肤】妖族天庭'))
  const fallback = normalizeClarification({ ...base, faction: 'no-such-faction' })
  assert.equal(fallback.faction, undefined)
})

test('the founding UI exposes the faction cards and sends the chosen id', () => {
  const dialog = readFileSync(new URL('../src/client/QuickStartDialog.tsx', import.meta.url), 'utf8')
  assert.match(dialog, /visibleFactions\.map/)
  assert.match(dialog, /useHiddenLineups/)
  assert.match(dialog, /data-control="quickstart-factions"/)
  assert.match(dialog, /selectFaction/)
  assert.match(dialog, /faction === undefined \? \{\} : \{ faction \}/)
  assert.match(dialog, /activeLineup/)
  assert.match(dialog, /useLineups/)
})
