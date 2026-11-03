/**
 * 对话输入区「停止当前任务并执行新任务」按钮（t33）。
 *
 * 只在「有任务在跑 + 有可调度的排队任务 + 没有空闲成员」时出现（防抖 300ms），
 * 两段式确认（3s 内二次点击才执行）；停止语义由 /task/preempt 承担：
 * cancelled + interruptMember + scheduler kick，对话本身不受影响。
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  getActivitySnapshotsSnapshot, subscribeActivitySnapshots,
  type ActivityTask, type ActivityTeam,
} from './activity-monitor.ts'
import type { AgentTeamsTranslate } from './locales.ts'
import css from './ComposerStopButton.module.css'

const PREEMPT_URL = '/plugins/dsh-super-agent/task/preempt'
/** 二次确认窗口：3s 内再点一次才真正叫停。 */
const ARM_WINDOW_MS = 3000
/** 条件连续满足这么久才显示，避免派发瞬间闪一下。 */
const SETTLE_MS = 300

function isRunning(task: ActivityTask): boolean {
  return task.state === 'running' || task.state === 'claimed'
}

/** 优先「running 且最早更新」的在跑任务；只停一个。 */
function pickRunning(tasks: readonly ActivityTask[]): ActivityTask | undefined {
  return [...tasks]
    .filter(isRunning)
    .sort((left, right) => (left.state === right.state
      ? (left.updatedAt ?? 0) - (right.updatedAt ?? 0)
      : left.state === 'running' ? -1 : 1))[0]
}

/** 排队中且依赖已全部完成的任务。 */
function pickReady(tasks: readonly ActivityTask[]): ActivityTask | undefined {
  const done = new Set(tasks.filter(task => task.status === 'completed').map(task => task.id))
  return tasks.find(task => task.status === 'pending' && task.dependencies.every(id => done.has(id)))
}

function selectTeam(teams: readonly ActivityTeam[], sessionId: string | undefined): ActivityTeam | undefined {
  if (sessionId === undefined) return undefined
  return teams.find(team => team.captainSessionId === sessionId)
}

export function ComposerStopButton({ sessionId, t }: {
  readonly sessionId?: SessionId
  readonly t: AgentTeamsTranslate
}) {
  const snapshots = useSyncExternalStore(subscribeActivitySnapshots, getActivitySnapshotsSnapshot)
  const team = useMemo(() => selectTeam(snapshots.teams, sessionId), [snapshots, sessionId])
  const running = team === undefined ? undefined : pickRunning(team.tasks)
  const ready = team === undefined ? undefined : pickReady(team.tasks)
  // 五条显隐条件（缺一不显示）。
  const eligible = team !== undefined
    && team.phase === 'running'
    && team.halted !== true
    && running !== undefined
    && ready !== undefined
    && ready.id !== running.id
    && team.members.every(member => member.status !== 'idle')
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!eligible) { setSettled(false); return }
    const timer = window.setTimeout(() => { setSettled(true) }, SETTLE_MS)
    return () => { window.clearTimeout(timer) }
  }, [eligible])
  const visible = eligible && settled

  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState('')
  useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => { setArmed(false) }, ARM_WINDOW_MS)
    return () => { window.clearTimeout(timer) }
  }, [armed])
  useEffect(() => {
    if (notice === '') return
    const timer = window.setTimeout(() => { setNotice('') }, 3000)
    return () => { window.clearTimeout(timer) }
  }, [notice])
  useEffect(() => { if (!visible) { setArmed(false); setFailed('') } }, [visible])

  if (!visible || running === undefined || ready === undefined || sessionId === undefined) return null

  const submit = async (): Promise<void> => {
    if (!armed) { setArmed(true); setFailed(''); return }
    setArmed(false)
    setBusy(true)
    setFailed('')
    try {
      const response = await fetch(PREEMPT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const body = await response.json() as { ok?: boolean; stoppedTaskId?: string; nextTaskId?: string; started?: boolean; error?: string }
      if (!response.ok || body.ok !== true) throw new Error(body.error ?? 'HTTP ' + response.status)
      // t67：服务端说没法立刻开跑时不要谎报「正在启动」。
      setNotice(t(body.started === false ? 'preempt.stoppedIdle' : 'preempt.started', {
        stopped: body.stoppedTaskId ?? running?.id ?? '',
        next: body.nextTaskId ?? ready?.id ?? '',
      }))
    } catch (error: unknown) {
      setFailed(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={css.dock} data-composer-preempt>
      <button
        type="button"
        className={css.button}
        data-armed={armed || undefined}
        disabled={busy}
        onClick={() => { void submit() }}
      >
        {armed ? t('preempt.confirm') : t('preempt.button')}
      </button>
      <span className={css.hint}>
        {t('preempt.hint', { stopped: running.id + '·' + running.subject, next: ready.id + '·' + ready.subject })}
      </span>
      {notice !== '' && <span className={css.notice} role="status">{notice}</span>}
      {failed !== '' && <span className={css.failed} role="alert">{t('preempt.failed', { error: failed })}</span>}
    </div>
  )
}
