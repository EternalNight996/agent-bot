/**
 * Mode lineup presets: every offered mode owns one roster, and the founding
 * lobby defaults to it. Stress test is a first-class offered mode.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { PRIMARY_MODES } from '../lib/modes.js'
import { MODE_LINEUP_PREFIX, MODE_ROSTERS, modeLineup, modeLineupId } from '../lib/client/mode-lineups.js'

test('every offered mode owns a lineup preset the founding lobby can default to', () => {
  assert.deepEqual([...PRIMARY_MODES], ['draft', 'analysis', 'plan', 'precision', 'compliance', 'stress'])
  for (const mode of PRIMARY_MODES) {
    const id = modeLineupId(mode)
    assert.equal(id, MODE_LINEUP_PREFIX + mode)
    const roster = MODE_ROSTERS[mode]
    assert.ok(Array.isArray(roster) && roster.length >= 3, mode + ' needs a usable roster')
    assert.ok(roster.length <= 5, mode + ' roster must stay at or below the 5-seat cap')
    const seats = modeLineup(mode)
    assert.equal(seats.length, roster.length)
    assert.deepEqual(seats.map(seat => seat.role), [...roster])
    assert.ok(seats.every(seat => seat.role !== '' && seat.name !== '' && seat.skin !== ''))
    assert.equal(new Set(seats.map(seat => seat.skin)).size, seats.length, 'seats must not share a portrait')
  }
})

test('stress test ships a performance-oriented roster', () => {
  const roster = MODE_ROSTERS.stress
  assert.ok(roster.includes('testing-performance-benchmarker'))
  assert.ok(roster.includes('engineering-devops-automator'))
  assert.ok(roster.includes('product-manager'))
  const seats = modeLineup('stress')
  assert.ok(seats.some(seat => /benchmark|performance/i.test(seat.name) || seat.role.includes('performance')))
})
