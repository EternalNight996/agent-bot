#!/usr/bin/env node
/**
 * Inspect or rewrite the packed expert prompt payload.
 *
 * src/agency-role-prompts.ts stores the 83 prompt bodies as one Brotli+base64
 * literal so the repository does not carry ~620 KB of readable duplicate text
 * (source plus committed build output). This is the escape hatch:
 *
 *   node scripts/role-prompts.mjs --decode [file.json]   write a readable copy
 *   node scripts/role-prompts.mjs --encode [file.json]   pack a readable copy back
 *   node scripts/role-prompts.mjs --check                verify the payload decodes
 *
 * The decoded file defaults to `role-prompts.json` in the repository root and is
 * gitignored: edit it, run --encode, then rebuild.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib'

const root = join(import.meta.dirname, '..')
const sourcePath = join(root, 'src/agency-role-prompts.ts')
const defaultJson = join(root, 'role-prompts.json')
const PACKED_PATTERN = /const PACKED = "([^"]*)"/

function readPacked() {
  const source = readFileSync(sourcePath, 'utf8')
  const match = PACKED_PATTERN.exec(source)
  if (match === null) throw new Error('src/agency-role-prompts.ts has no PACKED literal')
  return { source, packed: match[1] }
}

function decode(packed) {
  return JSON.parse(brotliDecompressSync(Buffer.from(packed, 'base64')).toString('utf8'))
}

function validate(prompts) {
  if (typeof prompts !== 'object' || prompts === null || Array.isArray(prompts)) {
    throw new Error('prompt payload must be an object keyed by role id')
  }
  for (const [role, prompt] of Object.entries(prompts)) {
    if (typeof prompt !== 'string' || prompt.trim() === '') throw new Error('empty prompt for role ' + role)
  }
  return prompts
}

const args = process.argv.slice(2)
const mode = args[0]

if (mode === '--decode') {
  const target = args[1] ?? defaultJson
  const prompts = decode(readPacked().packed)
  writeFileSync(target, JSON.stringify(prompts, null, 2) + '\n')
  console.log('decoded ' + Object.keys(prompts).length + ' prompts to ' + target)
} else if (mode === '--encode') {
  const sourcePathIn = args[1] ?? defaultJson
  const prompts = validate(JSON.parse(readFileSync(sourcePathIn, 'utf8')))
  const json = JSON.stringify(prompts)
  const packed = brotliCompressSync(Buffer.from(json, 'utf8'), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: json.length },
  }).toString('base64')
  const { source } = readPacked()
  writeFileSync(sourcePath, source.replace(PACKED_PATTERN, () => 'const PACKED = ' + JSON.stringify(packed)))
  console.log('packed ' + Object.keys(prompts).length + ' prompts into ' + sourcePath)
} else if (mode === '--check') {
  const prompts = decode(readPacked().packed)
  const ids = Object.keys(prompts)
  if (ids.length < 80) throw new Error('prompt payload lost roles: ' + ids.length)
  console.log('packed role prompts decode: ' + ids.length + ' roles, ' + Buffer.byteLength(JSON.stringify(prompts)) + ' bytes')
} else {
  console.error('Usage: role-prompts.mjs --decode [file] | --encode [file] | --check')
  process.exitCode = 1
}
