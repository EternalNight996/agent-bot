import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_LEVEL, OFFLINE_CAP_MS, feedPet, levelOf, newPet, patPet, playPet,
  syncCompletedTasks, tickPet, xpForNextLevel,
} from '../lib/pet-model.js'

test('levels grow on a fixed curve and stop at the cap', () => {
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: 30 })
  assert.deepEqual(levelOf(30), { level: 2, into: 0, need: 50 })
  assert.deepEqual(levelOf(79), { level: 2, into: 49, need: 50 })
  assert.equal(levelOf(999999).level, MAX_LEVEL)
  assert.equal(xpForNextLevel(1), 30)
  assert.equal(xpForNextLevel(3), 70)
})

test('offline ticking decays satiety and mood, restores energy and caps at 12h', () => {
  const now = 1_800_000_000_000
  const pet = newPet(now)
  const later = tickPet(pet, now + 2 * 60 * 60 * 1000)
  assert.ok(later.satiety < pet.satiety)
  assert.ok(later.mood < pet.mood)
  assert.ok(later.energy >= pet.energy)
  const capped = tickPet(pet, now + 7 * 24 * 60 * 60 * 1000)
  const cappedAgain = tickPet(pet, now + OFFLINE_CAP_MS)
  assert.deepEqual({ satiety: capped.satiety, mood: capped.mood, energy: capped.energy }, { satiety: cappedAgain.satiety, mood: cappedAgain.mood, energy: cappedAgain.energy })
})

test('feeding fills satiety, grants xp and respects the cooldown', () => {
  const now = 1_800_000_000_000
  const pet = { ...newPet(now), satiety: 40 }
  const fed = feedPet(pet, now + 20_000)
  assert.equal(fed.ok, true)
  assert.ok(fed.pet.satiety > pet.satiety)
  assert.ok(fed.pet.xp > pet.xp)
  const again = feedPet(fed.pet, now + 21_000)
  assert.equal(again.ok, false)
  assert.equal(again.reason, 'cooldown')
  const full = feedPet({ ...pet, satiety: 100 }, now + 60_000)
  assert.equal(full.reason, 'full')
})

test('playing needs energy and patting only nudges mood', () => {
  const now = 1_800_000_000_000
  const tired = playPet({ ...newPet(now), energy: 5 }, now + 60_000)
  assert.equal(tired.ok, false)
  assert.equal(tired.reason, 'tired')
  const happy = playPet({ ...newPet(now), energy: 60 }, now + 60_000)
  assert.equal(happy.ok, true)
  assert.ok(happy.pet.mood >= 80)
  const patted = patPet(newPet(now), now + 10_000)
  assert.equal(patted.ok, true)
  assert.equal(patted.pet.xp, 2)
})

test('completed tasks award xp only for the delta', () => {
  const base = newPet(1)
  const first = syncCompletedTasks(base, 3)
  assert.equal(first.xp, 36)
  assert.equal(first.lastTaskCount, 3)
  const repeat = syncCompletedTasks(first, 3)
  assert.equal(repeat, first)
  const next = syncCompletedTasks(first, 5)
  assert.equal(next.xp, 60)
})
