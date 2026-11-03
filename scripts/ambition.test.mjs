/**
 * 道统 / 志向 defaults and their durable projection into the constitution.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_AMBITION, AMBITION_IDS, getAmbitionSpec, isAmbitionId, ambitionPhilosophyText } from '../lib/ambition.js'
import { DEFAULT_DOCTRINE, DOCTRINE_IDS, doctrinePhilosophyText, isDoctrineId } from '../lib/doctrine.js'
import { normalizeClarification, describeClarification } from '../lib/clarify.js'
import { buildConstitution, writeConstitution, readConstitution } from '../lib/constitution.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = {
  type: 'software',
  scale: 'small',
  mode: 'draft',
  ui: { styles: [] },
  platforms: ['Windows'],
  hardwareList: [],
  constraints: [],
  excluded: [],
  acceptance: ['主流程跑通'],
  memoryHints: [],
}

test('道统 defaults to 功能直交; 视觉爆炸 is optional and off by default', () => {
  assert.equal(DEFAULT_DOCTRINE, 'ship')
  assert.equal(DEFAULT_AMBITION, 'visual')
  assert.ok(isDoctrineId('ship') && !isDoctrineId('nope'))
  assert.ok(isAmbitionId('visual') && !isAmbitionId('nope'))
  assert.equal(getAmbitionSpec('visual').name, '视觉爆炸')
  assert.ok(ambitionPhilosophyText('visual').includes('视觉爆炸'))
  // An unselected ambition must cost nothing: no philosophy block at all.
  assert.equal(ambitionPhilosophyText(undefined), '')
  assert.ok(doctrinePhilosophyText(DEFAULT_DOCTRINE).includes('功能直交'))
  assert.ok(AMBITION_IDS.includes('companion'))
  assert.ok(DOCTRINE_IDS.includes('ship'))
})

test('clarification normalization records doctrine and keeps the ambition optional', () => {
  const defaults = normalizeClarification(base)
  assert.equal(defaults.doctrine, 'ship')
  assert.equal(defaults.ambition, undefined)
  assert.equal(defaults.reference, undefined)
  const explicit = normalizeClarification({
    ...base,
    doctrine: 'fix',
    ambition: 'evidence',
    reference: { input: 'owner/repo', kind: 'github', label: 'owner/repo', stack: ['Rust', 'egui'] },
  })
  assert.equal(explicit.doctrine, 'fix')
  assert.equal(explicit.ambition, 'evidence')
  assert.equal(explicit.reference?.kind, 'github')
  assert.deepEqual(explicit.reference?.stack, ['Rust', 'egui'])
  // Unknown ids fall back to the durable defaults instead of invalid data.
  const invalid = normalizeClarification({ ...base, doctrine: 'bogus', ambition: 'bogus' })
  assert.equal(invalid.doctrine, 'ship')
  assert.equal(invalid.ambition, undefined)
  // A reference marker is capped and a bare string is accepted as a local path.
  const short = normalizeClarification({ ...base, reference: '  ./ref  ' })
  assert.equal(short.reference?.input, './ref')
  assert.equal(short.reference?.kind, 'local')
})

test('the rendered form and the constitution carry doctrine/ambition/reference', async () => {
  const clarification = normalizeClarification({
    ...base,
    doctrine: 'ship',
    ambition: 'visual',
    reference: { input: 'demo-ref', kind: 'local', label: 'demo-ref', stack: ['Rust', 'egui'] },
  })
  const markdown = describeClarification(clarification)
  assert.ok(markdown.includes('【法脉】功能直交'))
  assert.ok(markdown.includes('【宏愿】视觉爆炸'))
  assert.ok(markdown.includes('【参考项目】demo-ref'))
  assert.ok(markdown.includes('【类型】'))
  // The default (visual off) form must not mention an ambition at all.
  const plain = describeClarification(normalizeClarification(base))
  assert.ok(!plain.includes('【宏愿】'))

  const workspace = mkdtempSync(join(tmpdir(), 'pixel-founding-'))
  try {
    const constitution = buildConstitution(clarification, 'demo')
    assert.equal(constitution.doctrine, 'ship')
    assert.equal(constitution.ambition, 'visual')
    assert.equal(constitution.reference?.label, 'demo-ref')
    const written = await writeConstitution(workspace, 'demo', constitution)
    const read = await readConstitution(workspace, 'demo')
    assert.ok(read !== undefined)
    assert.equal(read.json.doctrine, 'ship')
    assert.equal(read.json.ambition, 'visual')
    assert.equal(read.checksum, written.checksum)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('legacy constitutions read back with the current defaults and no ambition', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'pixel-founding-legacy-'))
  try {
    const clarification = normalizeClarification(base)
    const constitution = buildConstitution(clarification, 'legacy')
    await writeConstitution(workspace, 'legacy', constitution)
    const read = await readConstitution(workspace, 'legacy')
    assert.equal(read?.json.doctrine, 'ship')
    assert.equal(read?.json.ambition, undefined)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
