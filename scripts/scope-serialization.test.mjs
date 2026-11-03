// Generated plans hand every implementation task the same workspace-wide
// inScope; the host then refuses the second create_task with
// "inScope overlaps tN; serialize these tasks or split the paths".
// The plan builder must chain those tasks instead of staging a rejected DAG.
import test from 'node:test'
import assert from 'node:assert/strict'
import { serializeOverlappingWriteTasks } from '../lib/quick-start.js'

const task = (id, overrides = {}) => ({
  id,
  subject: id,
  description: '',
  assignee: 'a',
  dependencies: [],
  ...overrides,
})

test('parallel write tasks that share a scope gain a dependency chain', () => {
  const tasks = [
    task('t1', { kind: 'implementation', inScope: ['projects/app/'] }),
    task('t2', { kind: 'implementation', inScope: ['projects/app/'] }),
    task('t3', { kind: 'implementation', inScope: ['projects/app/'] }),
  ]
  serializeOverlappingWriteTasks(tasks)
  assert.ok(tasks[1].dependencies.includes('t1'), 't2 must wait for t1')
  assert.ok(tasks[2].dependencies.includes('t2'), 't3 must wait for t2')
  assert.equal(tasks[0].dependencies.length, 0)
})

test('already serialized or disjoint scopes are left alone', () => {
  const serialized = [
    task('t1', { kind: 'implementation', inScope: ['projects/app/'] }),
    task('t2', { kind: 'implementation', inScope: ['projects/app/'], dependencies: ['t1'] }),
  ]
  serializeOverlappingWriteTasks(serialized)
  assert.deepEqual(serialized[1].dependencies, ['t1'])

  const disjoint = [
    task('t1', { kind: 'implementation', inScope: ['projects/app/web/'] }),
    task('t2', { kind: 'implementation', inScope: ['projects/app/api/'] }),
  ]
  serializeOverlappingWriteTasks(disjoint)
  assert.deepEqual(disjoint[1].dependencies, [])
})

test('repairs serialize too, but non-writing gates do not trigger chains', () => {
  const tasks = [
    task('t1', { kind: 'implementation', inScope: ['src/'] }),
    task('t2', { kind: 'repair', inScope: ['src/'] }),
    task('t3', { kind: 'verification', inScope: ['src/'] }),
    task('t4', { kind: 'review', inScope: ['src/'] }),
  ]
  serializeOverlappingWriteTasks(tasks)
  assert.ok(tasks[1].dependencies.includes('t1'))
  assert.deepEqual(tasks[2].dependencies, [])
  assert.deepEqual(tasks[3].dependencies, [])
})

test('a dependency in the other direction prevents a cycle', () => {
  const tasks = [
    task('t1', { kind: 'implementation', inScope: ['src/'], dependencies: ['t2'] }),
    task('t2', { kind: 'implementation', inScope: ['src/'] }),
  ]
  serializeOverlappingWriteTasks(tasks)
  assert.deepEqual(tasks[1].dependencies, [], 't2 must not depend on t1 when t1 already depends on t2')
})
