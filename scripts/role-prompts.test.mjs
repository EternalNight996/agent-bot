import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { AGENCY_ROLE_PROMPTS } from '../lib/agency-role-prompts.js'
import { AGENCY_ROLE_SEEDS } from '../lib/agency-role-seeds.js'

test('the packed prompt payload decodes to a body for every catalog role', () => {
  const ids = Object.keys(AGENCY_ROLE_PROMPTS)
  assert.ok(ids.length >= 80, 'prompt payload lost roles: ' + ids.length)
  for (const seed of AGENCY_ROLE_SEEDS) {
    const prompt = AGENCY_ROLE_PROMPTS[seed.id]
    assert.equal(typeof prompt, 'string', 'missing prompt for ' + seed.id)
    assert.ok(prompt.length > 80, 'suspiciously short prompt for ' + seed.id)
  }
  assert.ok(AGENCY_ROLE_PROMPTS['product-manager'].includes('产品经理'))
})

test('the source keeps prompts packed instead of shipping raw text twice', () => {
  const source = readFileSync(new URL('../src/agency-role-prompts.ts', import.meta.url), 'utf8')
  assert.ok(source.includes('const PACKED = "'), 'source must keep one packed literal')
  assert.equal(source.includes('产品经理智能体'), false, 'raw prompt text must not be inlined')
  assert.ok(Buffer.byteLength(source) < 600 * 1024, 'packed source grew past its budget')
})

test('the decode/encode helper accepts the current payload', () => {
  const out = execFileSync(process.execPath, ['scripts/role-prompts.mjs', '--check'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
  assert.match(out, /packed role prompts decode: \d+ roles/)
})
