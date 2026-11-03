/**
 * 三界行囊: remembered founding choices, layered reference memory, clearing.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  foundingBagPath,
  layerReferenceDefaults,
  readFoundingBag,
  rememberFounding,
  sanitizeFoundingBag,
  writeFoundingBag,
} from '../lib/founding-bag.js'

function profile() {
  return {
    version: 1,
    input: './demo',
    kind: 'local',
    label: 'demo',
    analyzedAt: 111,
    stack: { languages: ['Rust'], uiFramework: 'egui/eframe', crossPlatform: 'egui/eframe 跨平台桌面', targets: ['Windows', 'macOS', 'Linux (UOS/麒麟)'], packageManagers: ['cargo', 'just'] },
    habits: { readmeSections: ['Install'], hasJustfile: true, justRecipes: ['build'], scripts: {}, dirs: ['src/'], ci: [], release: [] },
    inferred: {
      platforms: ['Windows', 'macOS', 'Linux (UOS/麒麟)'],
      uiStyles: ['桌面端传统'],
      constraints: ['参考项目：demo（Rust）'],
      memoryHints: ['demo', 'Rust'],
      notes: [],
      verify: ['just build'],
    },
    evidence: ['Cargo.toml'],
    digest: '参考项目：demo',
  }
}

test('the bag remembers doctrine/ambition/mode/reference and keeps corrections separate', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'pixel-bag-'))
  try {
    const saved = await rememberFounding(workspace, {
      doctrine: 'fix',
      ambition: 'evidence',
      mode: 'precision',
      reference: { input: './demo', kind: 'local', label: 'demo', analyzedAt: 111, profile: profile() },
      corrections: { platforms: ['Linux (UOS/麒麟)'] },
    })
    assert.equal(saved.doctrine, 'fix')
    assert.equal(saved.ambition, 'evidence')
    assert.equal(saved.mode, 'precision')
    assert.equal(saved.reference?.label, 'demo')
    assert.deepEqual(saved.corrections?.platforms, ['Linux (UOS/麒麟)'])

    const read = await readFoundingBag(workspace)
    assert.equal(read?.doctrine, 'fix')
    assert.equal(read?.reference?.profile?.inferred.uiStyles[0], '桌面端传统')

    // High-priority corrections REPLACE the reference default, not append.
    const layered = layerReferenceDefaults(read.reference.profile.inferred, read.corrections)
    assert.deepEqual(layered.defaults.platforms, ['Linux (UOS/麒麟)'])
    assert.deepEqual(layered.overridden, ['platforms'])
    assert.deepEqual(layered.defaults.uiStyles, ['桌面端传统'])

    // Later foundings keep the reference until it is explicitly cleared.
    const kept = await rememberFounding(workspace, { ambition: 'visual' })
    assert.equal(kept.reference?.label, 'demo')
    assert.equal(kept.ambition, 'visual')
    assert.equal(kept.doctrine, 'fix')

    // 用户清空则不参考.
    const cleared = await rememberFounding(workspace, { reference: null })
    assert.equal(cleared.reference, undefined)
    assert.equal(cleared.doctrine, 'fix')
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('a corrupt or hostile bag never blocks founding', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'pixel-bag-corrupt-'))
  try {
    mkdirSync(join(workspace, '.pixel-team'), { recursive: true })
    writeFileSync(foundingBagPath(workspace), '{not json', 'utf8')
    assert.equal(await readFoundingBag(workspace), undefined)

    const hostile = sanitizeFoundingBag({
      version: 1,
      doctrine: 'rm -rf',
      ambition: 'x',
      mode: 'y',
      reference: { input: 'x'.repeat(900), kind: 'nope', profile: { version: 1, stack: { languages: Array(50).fill('R') } } },
      corrections: { platforms: Array(100).fill('P') },
    })
    assert.ok(hostile !== undefined)
    assert.equal(hostile.doctrine, undefined)
    assert.equal(hostile.ambition, undefined)
    assert.equal(hostile.mode, undefined)
    assert.equal(hostile.reference?.input.length, 500)
    assert.equal(hostile.reference?.kind, 'local')
    assert.ok((hostile.corrections?.platforms ?? []).length <= 8)

    const written = await writeFoundingBag(workspace, hostile)
    assert.equal(written.version, 1)
    assert.ok((await readFoundingBag(workspace)) !== undefined)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
