/**
 * 参考项目 analysis: input classification, stack/habit inference, degradation.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analyzeReference, clarifyReferenceOf, classifyReference } from '../lib/reference-project.js'

function fixture() {
  const workspace = mkdtempSync(join(tmpdir(), 'pixel-reference-'))
  const repo = join(workspace, 'demo-app')
  mkdirSync(join(repo, 'src'), { recursive: true })
  mkdirSync(join(repo, 'assets'), { recursive: true })
  writeFileSync(join(repo, 'Cargo.toml'), [
    '[package]',
    'name = "demo-app"',
    'edition = "2021"',
    '',
    '[dependencies]',
    'eframe = "0.27"',
    'egui = "0.27"',
    '',
  ].join('\n'))
  writeFileSync(join(repo, 'justfile'), [
    'build:',
    '    cargo build',
    'test:',
    '    cargo test',
    'check:',
    '    cargo check',
    'release:',
    '    cargo build --release',
    '',
  ].join('\n'))
  writeFileSync(join(repo, 'README.md'), [
    '# Demo App',
    '',
    '## Install',
    '## Build',
    '## Usage',
    '## Cross platform',
    '',
  ].join('\n'))
  writeFileSync(join(repo, 'tauri.conf.json'), '{"productName":"demo"}')
  return { workspace, repo }
}

test('a local Rust + egui + just project infers stack, platforms and habits', async () => {
  const { workspace, repo } = fixture()
  try {
    const profile = await analyzeReference(workspace, repo)
    assert.equal(profile.kind, 'local')
    assert.deepEqual(profile.stack.languages, ['Rust'])
    assert.equal(profile.stack.uiFramework, 'egui/eframe')
    assert.ok(profile.stack.crossPlatform?.includes('egui'))
    assert.deepEqual(profile.stack.targets, ['Windows', 'macOS', 'Linux (UOS/麒麟)'])
    assert.equal(profile.stack.buildSystem, 'just')
    assert.equal(profile.habits.hasJustfile, true)
    assert.ok(profile.habits.justRecipes.includes('build'))
    assert.ok(profile.habits.readmeSections.includes('Install'))
    assert.ok(profile.habits.release.length > 0, 'tauri.conf.json must be reported as release wiring')
    // Inferred clarification defaults, not raw files.
    assert.deepEqual(profile.inferred.platforms, ['Windows', 'macOS', 'Linux (UOS/麒麟)'])
    assert.deepEqual(profile.inferred.uiStyles, ['桌面端传统'])
    assert.ok(profile.inferred.constraints.some(item => item.includes('参考项目')))
    assert.ok(profile.inferred.constraints.some(item => item.includes('just')))
    assert.ok(profile.inferred.verify.includes('just build'))
    assert.ok(profile.inferred.verify.includes('just test'))
    assert.ok(profile.inferred.memoryHints.includes('Rust'))
    assert.ok(profile.digest.includes('参考项目'))
    assert.ok(profile.digest.includes('egui'))
    // The durable marker keeps only the compact summary.
    const marker = clarifyReferenceOf(profile)
    assert.equal(marker.kind, 'local')
    assert.ok(marker.stack?.includes('Rust'))
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('reference inputs are classified as local / github / url', () => {
  const workspace = 'C:\\workspace'
  assert.equal(classifyReference('https://github.com/acme/demo.git', workspace)?.kind, 'github')
  assert.equal(classifyReference('acme/demo', workspace)?.kind, 'github')
  assert.equal(classifyReference('git@github.com:acme/demo.git', workspace)?.kind, 'github')
  assert.equal(classifyReference('https://example.com/product', workspace)?.kind, 'url')
  assert.equal(classifyReference('C:\\projects\\demo', workspace)?.kind, 'local')
  assert.equal(classifyReference('./demo', workspace)?.kind, 'local')
  assert.equal(classifyReference('   ', workspace), undefined)
})

test('a missing local path is a user error, not a degraded read', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'pixel-reference-missing-'))
  try {
    await assert.rejects(analyzeReference(workspace, join(workspace, 'nope')), /不存在/)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('a GitHub repo is analyzed through the injected fetch and degrades gracefully', async () => {
  const seen = []
  const fakeFetch = async (url) => {
    seen.push(url)
    if (url.includes('api.github.com')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ language: 'Rust', description: 'demo repo', default_branch: 'main' }) }
    }
    if (url.endsWith('/README.md')) return { ok: true, status: 200, text: async () => '# Demo\n\n## Install\n## Build\n' }
    if (url.endsWith('/Cargo.toml')) return { ok: true, status: 200, text: async () => '[dependencies]\neframe = "0.27"\n' }
    return { ok: false, status: 404, text: async () => '' }
  }
  const profile = await analyzeReference('C:\\workspace', 'acme/demo', { fetchImpl: fakeFetch, timeoutMs: 5_000 })
  assert.equal(profile.kind, 'github')
  assert.equal(profile.stack.languages.includes('Rust'), true)
  assert.equal(profile.stack.uiFramework, 'egui/eframe')
  assert.ok(seen.some(url => url.includes('acme/demo')))

  const failing = async () => ({ ok: false, status: 503, text: async () => '' })
  const degraded = await analyzeReference('C:\\workspace', 'acme/demo', { fetchImpl: failing, timeoutMs: 5_000 })
  assert.ok(degraded.degraded !== undefined)
  assert.deepEqual(degraded.stack.languages, [])
})

test('a URL page contributes keyword signals', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => '<html><head><title>Demo</title></head><body>Rust + egui cross-platform desktop app with just build steps</body></html>',
  })
  const profile = await analyzeReference('C:\\workspace', 'https://example.com/demo', { fetchImpl: fakeFetch, timeoutMs: 5_000 })
  assert.equal(profile.kind, 'url')
  assert.ok(profile.stack.languages.includes('Rust'))
  assert.equal(profile.stack.uiFramework, 'egui/eframe')
  assert.ok(profile.inferred.platforms.length > 0)
})
