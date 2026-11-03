/** Delivery showcase: discovery, entry ranking, containment, HTML preview rewrite. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  MAX_SHOWCASE_FILE_BYTES,
  buildShowcase,
  normalizeShowcasePath,
  parseShowcaseFilePath,
  resolveShowcaseAsset,
  rewriteShowcaseHtml,
  showcaseKindOf,
  showcaseMediaType,
} from '../lib/showcase.js'

async function workspace(build) {
  const root = await mkdtemp(join(tmpdir(), 'pixel-showcase-'))
  await build(root)
  return root
}

async function write(root, path, body = '') {
  // `join` normalizes POSIX slashes on every platform; forcing `\\` produced a
  // single backslash-named file on Linux and made every discovery test fail.
  const absolute = join(root, path)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, body)
}

function team(overrides = {}) {
  return {
    id: 'team-demo',
    name: 'demo',
    planProjectRoot: 'projects/demo/',
    tasks: [
      { id: 't1', subject: 'build', status: 'completed', dependencies: [], changedPaths: ['projects/demo/pic.png'] },
      { id: 't2', subject: 'ship', status: 'completed', dependencies: ['t1'], deliverables: ['pelican.html'] },
    ],
    ...overrides,
  }
}

test('discovery lists declared artifacts and the product root, entry first', async () => {
  const root = await workspace(async (root) => {
    await write(root, 'projects/demo/index.html', '<html><head></head><body>hi</body></html>')
    await write(root, 'projects/demo/assets/app.js', 'console.log(1)')
    await write(root, 'projects/demo/README.md', '# readme')
    await write(root, 'projects/demo/pic.png', 'png')
    await write(root, 'projects/demo/node_modules/lib/index.js', 'skip')
    await write(root, 'projects/demo/.env', 'SECRET=1')
    await write(root, 'pelican.html', '<html></html>')
    await write(root, 'secret.txt', 'nope')
  })
  try {
    const view = buildShowcase(root, team())
    const paths = view.files.map(file => file.path)
    assert.equal(view.projectRoot, 'projects/demo')
    assert.equal(view.entry, 'projects/demo/index.html')
    assert.equal(view.files[0].path, 'projects/demo/index.html')
    assert.ok(paths.includes('projects/demo/assets/app.js'))
    assert.ok(paths.includes('projects/demo/pic.png'))
    assert.ok(paths.includes('projects/demo/README.md'))
    assert.ok(paths.includes('pelican.html'))
    assert.ok(!paths.some(path => path.includes('node_modules')))
    assert.ok(!paths.some(path => path.includes('.env')))
    assert.ok(!paths.includes('secret.txt'))
    assert.equal(view.files.find(file => file.path === 'pelican.html').declared, true)
    assert.equal(view.files.find(file => file.path === 'projects/demo/pic.png').declared, true)
    assert.equal(view.files.find(file => file.path === 'projects/demo/pic.png').kind, 'image')
    assert.equal(view.truncated, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a built dist/index.html is the entry when present', async () => {
  const root = await workspace(async (root) => {
    await write(root, 'projects/demo/index.html', '<html></html>')
    await write(root, 'projects/demo/dist/index.html', '<html></html>')
  })
  try {
    const view = buildShowcase(root, team())
    assert.equal(view.entry, 'projects/demo/dist/index.html')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('declared artifacts are the only listing without a product root', async () => {
  const root = await workspace(async (root) => {
    await write(root, 'build/out.html', '<html></html>')
    await write(root, 'other.txt', 'x')
  })
  try {
    const view = buildShowcase(root, team({
      planProjectRoot: undefined,
      tasks: [{ id: 't1', subject: 'ship', status: 'completed', dependencies: [], deliverables: ['build/out.html'] }],
    }))
    assert.equal(view.projectRoot, undefined)
    assert.deepEqual(view.files.map(file => file.path), ['build/out.html'])
    assert.equal(view.entry, 'build/out.html')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('normalization rejects absolute paths, drive letters and traversal', () => {
  assert.equal(normalizeShowcasePath('./projects/demo/'), 'projects/demo')
  assert.equal(normalizeShowcasePath('a\\b'), 'a/b')
  for (const bad of ['', '/etc/passwd', 'C:/Windows', '..', 'a/../b', 'a//b']) {
    assert.equal(normalizeShowcasePath(bad), undefined, bad)
  }
})

test('assets resolve only inside the product root or a declared artifact', async () => {
  const root = await workspace(async (root) => {
    await write(root, 'projects/demo/index.html', '<html></html>')
    await write(root, 'projects/demo/assets/app.js', 'x')
    await write(root, 'projects/demo/node_modules/lib/index.js', 'x')
    await write(root, 'pelican.html', '<html></html>')
    await write(root, 'secret.txt', 'x')
  })
  try {
    const demo = team()
    const asset = resolveShowcaseAsset(root, demo, 'projects/demo/assets/app.js')
    assert.equal(asset.ok, true)
    assert.equal(asset.asset.mediaType, 'text/javascript; charset=utf-8')
    assert.equal(resolveShowcaseAsset(root, demo, 'projects/demo/node_modules/lib/index.js').ok, false)
    assert.equal(resolveShowcaseAsset(root, demo, 'projects/demo/node_modules/lib/index.js').status, 403)
    assert.equal(resolveShowcaseAsset(root, demo, 'secret.txt').status, 403)
    assert.equal(resolveShowcaseAsset(root, demo, 'projects/demo/missing.png').status, 404)
    assert.equal(resolveShowcaseAsset(root, demo, '../outside').status, 400)
    assert.equal(resolveShowcaseAsset(root, demo, 'pelican.html').ok, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('oversized artifacts are refused before streaming', async () => {
  const root = await workspace(async (root) => {
    await write(root, 'projects/demo/index.html', '<html></html>')
    await write(root, 'projects/demo/big.bin', Buffer.alloc(MAX_SHOWCASE_FILE_BYTES + 1))
  })
  try {
    assert.equal(resolveShowcaseAsset(root, team(), 'projects/demo/big.bin').status, 413)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('kinds and media types cover the previewable set', () => {
  assert.equal(showcaseKindOf('a/B.HTML'), 'html')
  assert.equal(showcaseKindOf('a/pic.PNG'), 'image')
  assert.equal(showcaseKindOf('a/run.py'), 'code')
  assert.equal(showcaseKindOf('a/readme.md'), 'markdown')
  assert.equal(showcaseKindOf('a/data.bin'), 'other')
  assert.equal(showcaseMediaType('a/index.html'), 'text/html; charset=utf-8')
  assert.equal(showcaseMediaType('a/pic.png'), 'image/png')
  assert.equal(showcaseMediaType('a/data.bin'), 'application/octet-stream')
})

test('HTML preview pins relative references and re-anchors root-relative ones', () => {
  const html = '<!doctype html><html><head><title>x</title></head><body>'
    + '<script src="/assets/app.js"></script>'
    + "<link rel='stylesheet' href='/assets/app.css'>"
    + '<img src="./hero.png">'
    + '</body></html>'
  const out = rewriteShowcaseHtml(html, '/plugins/dsh-super-agent/showcase/file/s/t/projects/demo/dist/')
  assert.ok(out.includes('<base href="/plugins/dsh-super-agent/showcase/file/s/t/projects/demo/dist/">'))
  assert.ok(out.includes('src="/plugins/dsh-super-agent/showcase/file/s/t/projects/demo/dist/assets/app.js"'))
  assert.ok(out.includes("href='/plugins/dsh-super-agent/showcase/file/s/t/projects/demo/dist/assets/app.css'"))
  assert.ok(out.includes('src="./hero.png"'), 'relative references stay untouched')
  const headless = rewriteShowcaseHtml('<html></html>', '/mount')
  assert.ok(headless.startsWith('<base href="/mount/">'))
})

test('the preview mount parses session/team/path and rejects malformed URLs', () => {
  const prefix = '/plugins/dsh-super-agent/showcase/file'
  const encoded = ['projects', '鹈鹕骑单车', 'index.html'].map(segment => encodeURIComponent(segment)).join('/')
  assert.deepEqual(parseShowcaseFilePath(prefix + '/sid/team-1/' + encoded, prefix), {
    sessionId: 'sid', teamId: 'team-1', path: 'projects/鹈鹕骑单车/index.html',
  })
  assert.equal(parseShowcaseFilePath(prefix + '/sid/team-1', prefix), undefined)
  assert.equal(parseShowcaseFilePath(prefix + '/sid/team-1/', prefix), undefined)
  assert.equal(parseShowcaseFilePath(prefix + '/sid//a.html', prefix), undefined)
  assert.equal(parseShowcaseFilePath('/elsewhere/sid/team/a.html', prefix), undefined)
  assert.equal(parseShowcaseFilePath(prefix + '/sid/team/%E0%A4%A', prefix), undefined)
  assert.equal(parseShowcaseFilePath(prefix + '/sid/team/a.html', prefix).path, 'a.html')
})

