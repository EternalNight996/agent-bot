/**
 * Founding UI invariants: 功能直交 is the default doctrine, 视觉爆炸 and 复刻项目
 * live in the 目标 step, and the 需求 step parses a reference automatically.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { QUICK_START_TEMPLATES, buildQuickStartPlan } from '../lib/quick-start.js'

const dialog = readFileSync(new URL('../src/client/QuickStartDialog.tsx', import.meta.url), 'utf8')
const locales = readFileSync(new URL('../src/client/locales.ts', import.meta.url), 'utf8')
const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')

test('功能直交 is the shipped default doctrine, without a doctrine picker', () => {
  const ship = QUICK_START_TEMPLATES.find(template => template.id === 'ship')
  assert.ok(ship !== undefined)
  assert.equal(ship.label, '功能直交')
  assert.match(ship.tasks[0].description, /功能直交/)
  // Unknown ids fall back to the first template, which must be ship.
  assert.equal(buildQuickStartPlan('any goal', 'no-such-doctrine').template, 'ship')
  // 玄门道统（法脉）选项已去掉：和模式/阵容重复，向导固定用功能直交。
  assert.ok(!dialog.includes('quickstart-template-'), 'the doctrine cards must not render')
  assert.ok(!dialog.includes("currentStep === 'doctrine'"), 'the doctrine step is gone')
  assert.match(dialog, /useState<string>\('ship'\)/, 'the wizard pins the ship doctrine')
  assert.match(index, /DEFAULT_DOCTRINE/, 'the server route must default to the ship doctrine')
})

test('视觉爆炸 and 复刻项目 live in the 目标 step, with no separate 志向 step', () => {
  assert.match(dialog, /const STEPS = \['vow', 'board'\]/)
  assert.match(dialog, /data-control="quickstart-mode-slider"/, 'the mode and lineup are one slider')
  assert.match(dialog, /interviewState !== 'loading'/, 'the board waits until interview questions are ready')
  assert.match(locales, /'quickstart\.boardSubmit': '拍板'/, 'the final action is just 拍板')
  assert.match(dialog, /data-control="quickstart-crew-team"/, 'team mode shows a lineup')
  assert.match(dialog, /data-control="quickstart-crew-solo"/, 'solo mode runs a single character')
  assert.match(dialog, /quickstart-solo-role-/, 'solo mode picks exactly one role')
  assert.match(dialog, /setSoloRole/, 'the solo role is part of the founding payload')
  assert.match(dialog, /roles: solo \? \[soloRole\] : roles/, 'a solo team is one real member, not a captain-only plan')
  assert.ok(!dialog.includes("currentStep === 'sect'"), 'the lineup step is gone')
  assert.ok(!dialog.includes("currentStep === 'oath'"), 'the oath step is gone')
  assert.ok(!dialog.includes('data-step="ambition"'), 'the ambition step is merged into the goal step')
  assert.match(dialog, /quickstart\.ambitionLabel/)
  // 视觉爆炸 is an optional, off-by-default toggle in the 开发模式 block.
  assert.match(dialog, /data-control="quickstart-visual"/)
  assert.match(dialog, /visualEnabled \? 'visual' : undefined/)
  assert.match(dialog, /quickstart\.ambitionToggleHint/)
  assert.match(dialog, /data-control="quickstart-reference-pick"/)
  assert.match(dialog, /chooseReferenceFolder/)
})

test('复刻项目 opens the host picker and is parsed automatically in 需求', () => {
  assert.match(dialog, /pickDirectoryPath/, 'the goal step opens the host-native directory chooser')
  assert.match(dialog, /founding\/bag/, 'the wizard must read/write the remembered bag')
  assert.match(dialog, /mergeClarification/, 'the clarification must merge the inferred defaults')
  assert.match(dialog, /referenceAutoHint/)
  assert.match(dialog, /referenceAutoAnalyzed/)
  assert.ok(!dialog.includes('reference/analyze'), 'the wizard must not offer a manual analysis trigger')
  assert.match(index, /founding\/bag/)
  assert.match(index, /analyzeReference/, 'the 需求 route still analyzes the value automatically')
})

test('the founding entry opens the hall start page, never the inbox sheet', () => {
  const hall = readFileSync(new URL('../src/client/SectHallOverlay.tsx', import.meta.url), 'utf8')
  const workspace = readFileSync(new URL('../src/client/WorkspaceActivity.tsx', import.meta.url), 'utf8')
  assert.match(dialog, /OPEN_HALL_START_EVENT/)
  assert.doesNotMatch(dialog, /OPEN_HALL_SHEET_EVENT/)
  assert.match(hall, /OPEN_HALL_START_EVENT/)
  assert.match(hall, /setSheet\('start'\)/)
  assert.match(workspace, /action !== 'start'/, 'the workspace sheet must not route start into the inbox fallback')
})

test('the 洪荒协作 tab is a plain closable tab that can always be reopened', () => {
  const client = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  // 福地不再锁定标签：宿主自己的关闭按钮保留，右栏「开始」页的 guide 入口
  // 负责在关掉之后重新打开，所以这里既不该隐藏关闭按钮，也不该否决关闭。
  assert.match(client, /guide: \[\{\s*id: 'agent-teams-workspace'/)
  assert.ok(!client.includes('data-dockkit-tab-close'), 'the hall tab must not hide the host close button')
  assert.ok(!client.includes('registerCloseHandler'), 'the hall tab must not veto closing')
  assert.ok(!client.includes('the 洪荒协作 page is permanent'))
  // 驱动网关同样是普通可关标签，靠「展开结果」/交付自动打开的 window 事件重新拉起。
  assert.match(client, /OPEN_GATEWAY_EVENT/)
  // 不再把「用户关标签」当成收起福地的信号：标签必须被补回来。
  assert.ok(!client.includes('COLLAPSE_HALL_EVENT'))
})

test('the token show/hide control actually toggles and glides', () => {
  const hall = readFileSync(new URL('../src/client/SectHallOverlay.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/client/SectHallOverlay.module.css', import.meta.url), 'utf8')
  // 「显示」不能只开右栏：collapsed 不翻回来，福地内容不渲染、令牌继续压暗，
  // 看起来就是点了没反应。收起/展开必须走同一条 toggleCollapsed。
  assert.match(hall, /className={css\.tokenToggle}[\s\S]{0,400}?toggleCollapsed\(\)/)
  assert.doesNotMatch(hall, /if \(collapsed\) \{ bringHallBack\(\); return \}/)
  // 压暗/恢复走过渡而不是瞬切；悬浮桥接让按钮在鼠标从令牌移过去时不会消失。
  assert.match(css, /\.tokenWrap\[data-hidden='true'\] \.token \{[^}]*opacity: 0\.45/)
  assert.match(css, /transition: opacity 220ms ease/)
  assert.match(css, /\[data-hover='true'\] \.tokenToggle/)
  assert.match(hall, /onPointerEnter=\{holdTokenHover\}/)
})

test('goal attachments and plan agent executors are wired', () => {
  assert.match(dialog, /uploadGoalFiles/, 'the goal step must upload dropped files')
  assert.match(dialog, /onDrop=/)
  assert.match(dialog, /quickstart\.attach/)
  assert.match(index, /\/plugins\/dsh-super-agent\/upload/)
  const plan = readFileSync(new URL('../src/client/StagingPlanEditor.tsx', import.meta.url), 'utf8')
  assert.match(plan, /\/plugins\/dsh-super-agent\/agents/, 'the plan review must list execution agents')
  assert.match(plan, /plan\.member\.agent/)
  assert.match(plan, /syncModel/, 'the captain model can be synced per member')
})

test('the token stays plain while the pet lives in settings', () => {
  const config = readFileSync(new URL('../src/client/ConfigCenter.tsx', import.meta.url), 'utf8')
  const hall = readFileSync(new URL('../src/client/SectHallOverlay.tsx', import.meta.url), 'utf8')
  assert.match(config, /'pet', 'office\.settingsTabPet'/)
  assert.match(config, /<PetRoom/)
  assert.ok(!config.includes('data-control="token-skins"'), 'the 通用 token replacement is gone')
  assert.ok(!hall.includes('data-skin={tokenSkin}'), 'the hall token is back to the default token')
  const keys = ['office.settingsTabPet', 'pet.level', 'pet.feed', 'pet.stage.whale']
  for (const key of keys) {
    assert.ok(locales.split("'" + key + "'").length - 1 >= 2, key + ' must exist in zh and en')
  }
})

test('the create/clarify tool schemas accept the new durable fields', () => {
  const tools = readFileSync(new URL('../src/tools.ts', import.meta.url), 'utf8')
  // The quick-start route passes these through agent_teams_create's strict
  // clarification schema; a missing declaration would reject every founding.
  assert.match(tools, /doctrine: \{ type: 'string', enum: \[\.\.\.DOCTRINE_IDS\]/)
  assert.match(tools, /ambition: \{ type: 'string', enum: \[\.\.\.AMBITION_IDS\]/)
  assert.match(tools, /reference: \{\s*\n\s*type: 'object', additionalProperties: false/)
})

test('every new founding string exists in both dictionaries', () => {
  const keys = [
    'quickstart.stepGoal',
    'quickstart.stepInterview',
    'quickstart.summaryAmbition',
    'quickstart.summaryReference',
    'quickstart.ambitionLabel',
    'quickstart.ambitionToggleHint',
    'quickstart.ambitionOff',
    'quickstart.referenceTitle',
    'quickstart.referencePick',
    'quickstart.referenceAutoTitle',
    'quickstart.referenceAutoHint',
    'quickstart.referenceAutoAnalyzed',
    'quickstart.referenceAnalyze',
    'quickstart.referenceClear',
    'quickstart.rememberedHint',
  ]
  for (const key of keys) {
    const occurrences = locales.split("'" + key + "'").length - 1
    assert.ok(occurrences >= 2, key + ' must exist in zh and en (found ' + occurrences + ')')
  }
  assert.match(locales, /'quickstart\.stepInterview': '需求'/)
  assert.match(locales, /'quickstart\.summaryReference': '复刻项目'/)
})
