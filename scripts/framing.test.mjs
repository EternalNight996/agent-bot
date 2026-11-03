/**
 * 隐式任务定型: deterministic framing + auditable file, never UI copy.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyGoal, frameFounding, framingRelativePath, writeFramingAudit } from '../lib/framing.js'
import { normalizeClarification } from '../lib/clarify.js'

const clarification = normalizeClarification({
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
})

test('goal classification is deterministic and ordered', () => {
  assert.equal(classifyGoal('修复登录接口 500').goalKind, 'fix')
  assert.equal(classifyGoal('做一个数据看板界面').goalKind, 'ui')
  assert.equal(classifyGoal('调研本地大模型选型').goalKind, 'research')
  assert.equal(classifyGoal('打包并发布 v1').goalKind, 'build')
  assert.equal(classifyGoal('写一份 README 文档').goalKind, 'docs')
  assert.equal(classifyGoal('做一个记账工具').goalKind, 'feature')
  assert.deepEqual(classifyGoal('修复登录接口 500').signals.length > 0, true)
})

test('founding defaults to direct 功能直交 framing; other doctrines are gated', () => {
  const direct = frameFounding({ goal: '修复登录接口 500', clarification, at: 7 })
  assert.equal(direct.version, 1)
  assert.equal(direct.at, 7)
  assert.equal(direct.doctrine, 'ship')
  assert.equal(direct.doctrineName, '功能直交')
  assert.equal(direct.ambition, undefined)
  assert.ok(direct.note.includes('未启用'))
  assert.equal(direct.delivery, 'direct')
  assert.equal(direct.goalKind, 'fix')
  assert.ok(direct.note.includes('仅用于内部审计'))

  const gated = frameFounding({ goal: '修复登录接口 500', clarification: { ...clarification, doctrine: 'fix' } })
  assert.equal(gated.delivery, 'gated')
  assert.equal(gated.doctrineName, '修 Bug')

  const visual = frameFounding({ goal: '做一个数据看板界面', clarification: { ...clarification, ambition: 'visual' } })
  assert.equal(visual.ambition, 'visual')
  assert.ok(visual.note.includes('visual'))

  const referenced = frameFounding({
    goal: '做一个桌面看板',
    clarification: { ...clarification, reference: { input: 'demo/repo', kind: 'github', label: 'demo/repo' } },
  })
  assert.equal(referenced.reference?.label, 'demo/repo')
  assert.ok(referenced.note.includes('demo/repo'))
})

test('the framing audit is written next to the constitution and stays sanitized', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'pixel-framing-'))
  try {
    const framing = frameFounding({ goal: '做一个数据看板界面', clarification })
    const relative = await writeFramingAudit(workspace, '斗法宗/123', framing)
    assert.equal(relative, '.pixel-team/斗法宗-123-framing.json')
    assert.equal(framingRelativePath('x'), '.pixel-team/x-framing.json')
    const parsed = JSON.parse(readFileSync(join(workspace, relative), 'utf8'))
    assert.equal(parsed.delivery, 'direct')
    assert.equal(parsed.goalKind, 'ui')
    assert.equal(parsed.ambition, undefined)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
