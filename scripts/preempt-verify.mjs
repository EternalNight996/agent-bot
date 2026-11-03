/**
 * t39 静态 + 语义自检：composer 停任务按钮与 /task/preempt。
 *
 * 运行：node scripts/preempt-verify.mjs
 * 覆盖：
 *  - 路由注册与三段调用顺序（cancel → interrupt → kick）
 *  - 客户端 5 条显隐条件与两段式确认常量
 *  - 用真实的 lib/state.js 语义验证：被停任务 cancelled + output 含「用户从」且保留
 *    assignee/attempt/changedPaths/commandsRun；排队任务的就绪判定不受影响
 * 说明：真实「≤2s 变为 claimed」的时间证据需要宿主重启后新路由生效才能采集，
 *      本脚本只覆盖可离线判定的部分（见 T39-REPAIR.md 的阻断说明）。
 */
import { readFileSync } from 'node:fs'
import { cancelUnfinishedTask, unsatisfiedDependencies } from '../lib/state.js'
import { planPreemptHandover } from '../lib/preempt.js'

let failed = 0
const check = (name, ok, detail) => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : ' — ' + detail))
  if (!ok) failed += 1
}

const server = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/client/ComposerStopButton.tsx', import.meta.url), 'utf8')
const registration = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8')

check('路由已注册', server.includes("path: '/plugins/dsh-super-agent/task/preempt'"))
const cancelAt = server.indexOf("cancelUnfinishedTask(task, '用户从对话框叫停，准备执行新任务')")
const interruptAt = server.indexOf('interruptMember(ctx, captain, member.id)')
const kickAt = server.indexOf('agentTeamsRuntime.kickTeam(workspace, team.id)')
check('cancel → interrupt → kick 顺序', cancelAt > 0 && interruptAt > cancelAt && kickAt > interruptAt,
  `cancel@${cancelAt} interrupt@${interruptAt} kick@${kickAt}`)
check('保留 assignee/attempt/证据字段（未调用 invalidateTaskAttempt）', !server.slice(server.indexOf("path: '/plugins/dsh-super-agent/task/preempt'")).slice(0, 6000).includes('invalidateTaskAttempt('))

check('dock 槽注册', registration.includes("slots.inject('conversation.input.dock'"))
// t67：叫停后必须让「立刻开始」成立（必要时改派给被中断的成员），无法保证时如实回报 started=false。
const preemptBlock = server.slice(server.indexOf("path: '/plugins/dsh-super-agent/task/preempt'"), server.indexOf('task/review-confirm'))
check('t67 有改派分支', preemptBlock.includes('planPreemptHandover(') && preemptBlock.includes('queued.assignee = handover.name'))
check('t67 返回 started 字段', preemptBlock.includes('started,') && preemptBlock.includes('assignedTo'))
check('t67 改派只改 assignee/updatedAt', !/queued\.(status|attempt|attemptId|dependencies)\s*=/.test(preemptBlock))
check('t67 客户端区分两种文案', client.includes("preempt.stoppedIdle") && client.includes("body.started === false"))

check('组件 5 条条件', ["phase === 'running'", 'halted !== true', 'pickRunning', 'pickReady', "status !== 'idle'", 'SETTLE_MS'].every(k => client.includes(k)))
check('两段式确认 3s', client.includes('ARM_WINDOW_MS = 3000') && client.includes('if (!armed) { setArmed(true); setFailed(\'\'); return }'))

const baseTask = {
  id: 'tA', subject: '审查', status: 'in_progress', dependencies: [], assignee: '魔修',
  attempt: 2, attemptId: 'cap-1', updatedAt: 1,
  changedPaths: ['src/a.ts'], commandsRun: [{ command: 'pnpm test', status: 'passed', exitCode: 0 }],
  acceptanceResults: [{ criterion: 'x', status: 'passed' }],
}
const queued = { id: 'tB', subject: '修复', status: 'pending', dependencies: [], updatedAt: 1 }
const tasks = [baseTask, queued]
check('排队任务初始就绪', unsatisfiedDependencies(tasks, queued.dependencies).length === 0)
cancelUnfinishedTask(baseTask, '用户从对话框叫停，准备执行新任务')
check('被停任务 status=cancelled', baseTask.status === 'cancelled', baseTask.status)
check('output 含「用户从」', String(baseTask.output ?? '').includes('用户从'), JSON.stringify(baseTask.output))
check('保留 assignee', baseTask.assignee === '魔修')
check('保留 attempt', baseTask.attempt === 2)
check('保留 changedPaths', Array.isArray(baseTask.changedPaths) && baseTask.changedPaths.length === 1)
check('保留 commandsRun', Array.isArray(baseTask.commandsRun) && baseTask.commandsRun.length === 1)
check('保留 acceptanceResults', Array.isArray(baseTask.acceptanceResults) && baseTask.acceptanceResults.length === 1)
check('attemptId 已失效（防旧回合回写）', baseTask.attemptId === undefined)
check('排队任务仍就绪（调度器可认领）', unsatisfiedDependencies(tasks, queued.dependencies).length === 0)

// t67：改派决策矩阵（纯函数，与 /task/preempt 共用同一实现）
const M = (name, opts = {}) => ({ id: 'id-' + name, name, ...opts })
const team3 = [M('魔修'), M('毒修'), M('体修')]
const avail = (...names) => (member) => names.includes(member.name)

const caseA = planPreemptHandover({ next: { id: 't66', assignee: '魔修' }, members: team3, interrupted: M('毒修'), isAvailable: avail('毒修') })
check('t67 复现场景：owner 忙 + 被中断者空闲 → 改派给被中断者', caseA.started === true && caseA.reassignTo === '毒修', JSON.stringify(caseA))

const caseB = planPreemptHandover({ next: { id: 't66', assignee: '毒修' }, members: team3, interrupted: M('毒修'), isAvailable: avail('毒修') })
check('t67 对照场景：owner 就是被中断者 → 不改派、立刻开始', caseB.started === true && caseB.reassignTo === undefined, JSON.stringify(caseB))

const caseC = planPreemptHandover({ next: { id: 't66', assignee: '魔修' }, members: team3, interrupted: M('毒修'), isAvailable: avail('魔修') })
check('t67 owner 本来就空闲 → 不改派、立刻开始', caseC.started === true && caseC.reassignTo === undefined, JSON.stringify(caseC))

// 实测复现：interrupt 是异步的，判定时被中断成员通常还是 working —— 仍然要改派。
const caseD = planPreemptHandover({ next: { id: 't72', assignee: '毒修' }, members: team3, interrupted: M('魔修'), isAvailable: avail('毒修') === avail() ? avail() : () => false })
check('t67 被中断者此刻仍 working → 仍改派给它（不依赖 idle 门槛）', caseD.started === true && caseD.reassignTo === '魔修', JSON.stringify(caseD))

const caseD2 = planPreemptHandover({ next: { id: 't66', assignee: '魔修' }, members: team3, interrupted: undefined, isAvailable: avail() })
check('t67 无被中断成员且 owner 忙 → started=false（不谎报）', caseD2.started === false && caseD2.reassignTo === undefined, JSON.stringify(caseD2))

const caseE = planPreemptHandover({ next: undefined, members: team3, interrupted: M('毒修'), isAvailable: avail('毒修') })
check('t67 没有排队任务 → started=false', caseE.started === false, JSON.stringify(caseE))

const caseF = planPreemptHandover({ next: { id: 't66' }, members: team3, interrupted: M('毒修'), isAvailable: avail('毒修') })
check('t67 排队任务未指定 owner → 被中断者可用即立刻开始', caseF.started === true, JSON.stringify(caseF))

console.log(failed === 0 ? '\nALL PASS' : `\nFAILED: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
