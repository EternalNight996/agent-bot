import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const room = readFileSync(new URL('../src/client/PetRoom.tsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../src/client/HallSidebar.tsx', import.meta.url), 'utf8')
const hall = readFileSync(new URL('../src/client/SectHallOverlay.tsx', import.meta.url), 'utf8')
const config = readFileSync(new URL('../src/client/ConfigCenter.tsx', import.meta.url), 'utf8')
const locales = readFileSync(new URL('../src/client/locales.ts', import.meta.url), 'utf8')
const model = readFileSync(new URL('../src/pet-model.ts', import.meta.url), 'utf8')

test('the pet lives in settings, not as a hall tab, and keeps four interactions', () => {
  assert.match(config, /'pet', 'office\.settingsTabPet'/)
  assert.match(config, /<PetRoom/)
  assert.match(hall, /completedTasks=/)
  assert.ok(!sidebar.includes("page: 'pet'"), 'the hall nav no longer carries a pet tab')
  assert.ok(!hall.includes("<PetRoom"), 'the hall routes the pet through settings')
  assert.match(room, /data-control="pet-room"/)
  for (const kind of ['feed', 'pat', 'play', 'rest']) assert.match(room, new RegExp("'" + kind + "'"))
  assert.match(room, /tickPetNow/)
  assert.match(room, /syncTasks/)
  assert.match(room, /PET_SLEEP_ART/, 'the room shows the real sleep pose')
  assert.match(room, /wake\(/, 'clicking the sleeping pet wakes it')
  assert.match(hall, /PET_TOKEN_SLEEP_ART/, 'the token mirrors the sleep state')
})

test('sleep is a real ten-minute state, not an instant energy refill', () => {
  assert.match(model, /SLEEP_MS = 10 \* MINUTE/)
  assert.match(model, /sleepUntil/)
  assert.match(model, /wakePet/)
  for (const key of ['pet.wake', 'pet.sleepTimer', 'pet.speech.sleeping', 'pet.feedback.woke']) {
    assert.ok(locales.split("'" + key + "'").length - 1 >= 2, key + ' must exist in zh and en')
  }
})

test('the pet model keeps offline growth and stages explicit', () => {
  assert.match(model, /OFFLINE_CAP_MS/)
  assert.match(model, /stageOf/)
  assert.match(model, /whale/)
  const keys = ['office.floorPet', 'pet.level', 'pet.satiety', 'pet.mood', 'pet.energy', 'pet.feed', 'pet.play', 'pet.hint']
  for (const key of keys) assert.ok(locales.split("'" + key + "'").length - 1 >= 2, key + ' must exist in zh and en')
})
