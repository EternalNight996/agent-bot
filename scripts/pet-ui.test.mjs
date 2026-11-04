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
})

test('the pet model keeps offline growth and stages explicit', () => {
  assert.match(model, /OFFLINE_CAP_MS/)
  assert.match(model, /stageOf/)
  assert.match(model, /whale/)
  const keys = ['office.floorPet', 'pet.level', 'pet.satiety', 'pet.mood', 'pet.energy', 'pet.feed', 'pet.play', 'pet.hint']
  for (const key of keys) assert.ok(locales.split("'" + key + "'").length - 1 >= 2, key + ' must exist in zh and en')
})
