/** Module 3: 法脉·藏经阁 — live task progress list (single column, expand on click). */
import { useEffect, useState } from 'react'
import css from './LibraryPanel.module.css'
import { useLibraryState } from './library-stream.ts'
import type { AgentTeamsTranslate } from './locales.ts'
import { PLUGIN_VERSION } from './version.ts'
import { usdToCny } from '../currency.ts'
import { ACTIVITY_HALT_URL } from './activity-monitor.ts'
import { memberArtUrl } from './artwork.ts'
import { formatElapsed, teamElapsedCounting, teamElapsedMs } from './activity-model.ts'

interface DeliveryArtifact {
  readonly path: string
  readonly name: string
  readonly ext: string
  readonly kind: 'web' | 'python' | 'exe' | 'batch' | 'rust'
}

const ROLE_BY_KIND: Record<string, string> = {
  requirements: 'planner',
  implementation: 'implementer',
  repair: 'implementer',
  verification: 'verifier',
  review: 'reviewer',
  integration: 'operator',
}

const STATUS_KEY: Record<string, Parameters<AgentTeamsTranslate>[0]> = {
  pending: 'library.status.pending',
  claimed: 'library.status.claimed',
  in_progress: 'library.status.inProgress',
  completed: 'library.status.completed',
  failed: 'library.status.failed',
}

export function LibraryPanel({ sessionId, t, onStartTeam }: {
  readonly sessionId: string
  readonly t: AgentTeamsTranslate
  readonly onStartTeam?: () => void
}) {
  const { team, connected } = useLibraryState(sessionId)
  const [stopping, setStopping] = useState<Record<string, boolean>>({})
  const [stopArmed, setStopArmed] = useState<string | undefined>()
  const [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [teamStopArmed, setTeamStopArmed] = useState(false)
  const [teamStopping, setTeamStopping] = useState(false)
  const [teamStopError, setTeamStopError] = useState('')
  const [costByTask, setCostByTask] = useState<Record<string, number>>({})
  const [costTotals, setCostTotals] = useState({ usd: 0, tokens: 0 })
  const [artifacts, setArtifacts] = useState<DeliveryArtifact[]>([])
  const [artifactBusy, setArtifactBusy] = useState('')
  const [artifactNotice, setArtifactNotice] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let cancelled = false
    const teamQuery = team?.teamId === undefined ? '' : '&teamId=' + encodeURIComponent(team.teamId)
    void fetch('/plugins/dsh-super-agent/cost/report?sessionId=' + encodeURIComponent(sessionId) + teamQuery)
      .then(response => response.json())
      .then((body: { by_task?: { taskId: string; usd: number }[]; total_usd?: number; total_tokens?: number }) => {
        if (cancelled || body.by_task === undefined) return
        const next: Record<string, number> = {}
        for (const item of body.by_task) next[item.taskId] = item.usd
        setCostByTask(next)
        setCostTotals({ usd: body.total_usd ?? Object.values(next).reduce((sum, value) => sum + value, 0), tokens: body.total_tokens ?? 0 })
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [sessionId, team?.teamId, team?.tasks.length ?? 0])
  // 只有还在跑的取经队才需要每秒重算耗时；停止/结束/完成后停表（见 teamElapsedMs）。
  const elapsedCounting = team !== null && teamElapsedCounting(team)
  useEffect(() => {
    if (!elapsedCounting) return
    const timer = window.setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { window.clearInterval(timer) }
  }, [elapsedCounting])
  // 交付后一定要给用户看：交付产物统一在右侧栏「驱动网关」里展示（见
  // gateway.ts 与 DriverGateway），藏经阁页不再弹独立预览层。
  if (team === null) {
    return <p className={css.empty}>{t('library.empty')}</p>
  }
  const confirmReview = async (taskId: string): Promise<void> => {
    setConfirming(previous => ({ ...previous, [taskId]: true }))
    try {
      const response = await fetch('/plugins/dsh-super-agent/task/review-confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, taskId }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        setNotice(body?.error ?? t('library.confirmFailed'))
      }
    } finally {
      setConfirming(previous => ({ ...previous, [taskId]: false }))
    }
  }
  const stopTeam = async (): Promise<void> => {
    if (teamStopping) return
    setTeamStopping(true)
    setTeamStopError('')
    try {
      const response = await fetch(ACTIVITY_HALT_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, teamId: team.teamId }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'HTTP ' + response.status)
      }
      setTeamStopArmed(false)
    } catch (error) {
      setTeamStopError(error instanceof Error ? error.message : String(error))
    } finally {
      setTeamStopping(false)
    }
  }
  const stopTask = async (taskId: string): Promise<void> => {
    if (stopArmed !== taskId) { setStopArmed(taskId); return }
    setStopArmed(undefined)
    setStopping(previous => ({ ...previous, [taskId]: true }))
    try {
      await fetch('/plugins/dsh-super-agent/task/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, taskId }),
      })
    } finally {
      setStopping(previous => ({ ...previous, [taskId]: false }))
    }
  }
  const hasActive = team.tasks.some(task => task.status === 'pending' || task.status === 'claimed' || task.status === 'in_progress')
  const completedCount = team.tasks.filter(task => task.status === 'completed').length
  const failedCount = team.tasks.filter(task => task.status === 'failed' || task.status === 'cancelled').length
  const activeCount = team.tasks.filter(task => task.status === 'claimed' || task.status === 'in_progress').length
  const totalCost = costTotals.usd
  // 停止/结束/完成后耗时不涨：冻结在最后一次状态写入时间。
  const elapsed = formatElapsed(teamElapsedMs(team, now))
  return (
    <div className={css.root} data-library>
      <header className={css.head}>
        <span className={css.team}>{team.name}</span>
        <span className={css.mode} style={{ color: team.modeColor, borderColor: team.modeColor }}>{team.modeName}</span>
        <span className={css.scale}>{team.scale}</span>
        <span className={css.gate}>{t('library.gate', { pass: team.gate.passed, total: team.gate.total })}</span>
        <span className={css.version}>v{PLUGIN_VERSION}</span>
        {onStartTeam !== undefined && (
          <button type="button" className={css.startTeam} onClick={onStartTeam}>＋ {t('quickstart.entry')}</button>
        )}
        {notice !== '' && <span role="alert" style={{ color: '#ffb4a8', fontSize: 11 }}>{notice}</span>}
        <span className={connected ? css.live : css.offline}>{connected ? t('library.connected') : t('library.disconnected')}</span>
        {hasActive && (
          <span className={css.teamStop}>
            {teamStopArmed
              ? <>
                  <span>{t('team.stopConfirm')}</span>
                  <button type="button" disabled={teamStopping} onClick={() => { void stopTeam() }}>{teamStopping ? t('team.stopping') : t('team.stop')}</button>
                  <button type="button" onClick={() => { setTeamStopArmed(false) }}>{t('team.stopCancel')}</button>
                </>
              : <button type="button" onClick={() => { setTeamStopError(''); setTeamStopArmed(true) }}>■ {t('team.stop')}</button>}
            {teamStopError !== '' && <span className={css.teamStopError} role="alert">{teamStopError}</span>}
          </span>
        )}
      </header>
      <section className={css.overview} aria-label={t('library.overview')}>
        <span className={css.overviewStat} data-state="completed"><b>{completedCount}</b>/{team.tasks.length} {t('library.status.completed')}</span>
        <span className={css.overviewStat} data-state="active"><b>{activeCount}</b> {t('library.status.inProgress')}</span>
        <span className={css.overviewStat} data-state="failed"><b>{failedCount}</b> {t('library.status.failed')}</span>
        <span className={css.overviewStat}>{t('library.elapsed', { time: elapsed })}</span>
        <span className={css.overviewStat}>{t('library.tokens', { count: costTotals.tokens })}</span>
        <span className={css.overviewCost}>{t('library.totalCost', { cost: '¥' + usdToCny(totalCost).toFixed(2) })}</span>
      </section>
      {team.requirements.length > 0 && (() => {
        const totalFailures = team.tasks.reduce((sum, task) => sum + task.failures, 0)
        return (
          <section className={css.requirements}>
            <span className={css.reqTitle}>{t('library.requirements')}</span>
            <table className={css.reqTable}>
              <thead>
                <tr><th>#</th><th>{t('library.reqCol')}</th><th>{t('library.reqState')}</th><th>{t('library.reqFailures')}</th></tr>
              </thead>
              <tbody>
                {team.requirements.map((item, index) => {
                  const mapped = team.tasks.filter(task => task.coverageOf.includes(item))
                  const scoped = mapped.length > 0 ? mapped : team.tasks
                  const itemDone = scoped.length > 0 && scoped.every(task => task.status === 'completed')
                  const itemFailed = scoped.some(task => task.status === 'failed')
                  const itemFailures = scoped.reduce((sum, task) => sum + task.failures, 0)
                  return (
                    <tr key={index} data-state={itemDone ? 'pass' : itemFailed ? 'fail' : 'pending'}>
                      <td className={css.reqIndex}>{index + 1}</td>
                      <td className={css.reqText}>{item}</td>
                      <td className={css.reqState}>{itemDone ? 'PASS' : itemFailed ? 'FAIL' : t('library.inProgress')}</td>
                      <td className={css.reqFailuresCell}>{itemFailures}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>{t('library.reqFailuresTotal')}</td><td>{totalFailures}</td></tr>
              </tfoot>
            </table>
          </section>
        )
      })()}
      <span className={css.skeletonTitle}>{t('library.skeleton')}</span>
      <details className={css.architecture}>
        <summary>{t('library.architecture')}</summary>
        <pre className={css.archText}>{team.architecture}</pre>
      </details>
      <div className={css.list}>
        {team.tasks.map((task, index) => {
          const passed = task.acceptance.filter(item => item.status === 'pass').length
          const failed = task.acceptance.filter(item => item.status === 'fail').length
          const active = task.status === 'claimed' || task.status === 'in_progress'
          const open = expanded[task.id] === true
          const taskCost = costByTask[task.id]
          return (
            <div key={task.id} className={css.row} data-status={task.status}>
              <button
                type="button"
                className={css.rowHead}
                aria-expanded={open}
                onClick={() => { setExpanded(previous => ({ ...previous, [task.id]: !open })) }}
              >
                <span className={css.rowChevron} aria-hidden>{open ? '▾' : '▸'}</span>
                <span className={css.rowIndex}>{index + 1}</span>
                <code className={css.rowId}>{task.id}</code>
                <span className={css.rowSubject} title={task.subject}>{task.subject}</span>
                {memberArtUrl(task.assignee, ROLE_BY_KIND[task.kind] ?? '') !== null && (
                  <img className={css.rowArt} src={memberArtUrl(task.assignee, ROLE_BY_KIND[task.kind] ?? '') ?? ''} alt="" aria-hidden />
                )}
                <span className={css.rowMeta}>{task.assignee || t('library.unassigned')}</span>
                <span className={css.rowStatus}>{t(STATUS_KEY[task.status] ?? 'library.status.pending')}</span>
                <span className={css.rowAcceptance} data-failed={failed > 0 || undefined}>
                  {t('library.acceptance', { pass: passed, total: task.acceptance.length })}
                </span>
                {task.failures > 0 && <span className={css.rowFailures}>{t('library.failures', { count: task.failures })}</span>}
                {task.awaitingHuman && <span className={css.rowHuman}>{t('library.awaitingHuman')}</span>}
                {taskCost !== undefined && taskCost > 0 && (
                  <span className={css.rowCost}>{'¥' + usdToCny(taskCost).toFixed(2)}</span>
                )}
              </button>
              {task.awaitingHuman && (
                <button
                  type="button"
                  className={css.confirmReview}
                  disabled={confirming[task.id] === true}
                  title={t('library.confirmReview')}
                  onClick={() => { void confirmReview(task.id) }}
                >
                  {confirming[task.id] === true ? t('library.confirming') : '✓ ' + t('library.confirmReview')}
                </button>
              )}
              {active && (
                <button
                  type="button"
                  className={css.stop}
                  disabled={stopping[task.id] === true}
                  title={t('library.stop')}
                  onClick={() => { void stopTask(task.id) }}
                >
                  {stopping[task.id] === true ? t('library.stopping') : '■ ' + t('library.stop')}
                </button>
              )}
              {stopArmed === task.id && (
                <span role="alertdialog" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 6, fontSize: 11, color: '#ffd7a0' }}>
                  <span>{t('library.stopConfirm')}</span>
                  <button type="button" className={css.stop} onClick={() => { void stopTask(task.id) }}>{t('library.confirm')}</button>
                  <button type="button" className={css.stop} onClick={() => { setStopArmed(undefined) }}>{t('library.cancel')}</button>
                </span>
              )}
              {open && (
                <div className={css.rowDetail}>
                  {task.description !== '' && <span className={css.detailDesc}>{task.description}</span>}
                  <span className={css.detailMeta}>
                    {t('library.deps')}: {task.dependencies.join(', ') || t('library.noDeps')} · {task.kind}
                  </span>
                  {task.acceptance.length > 0 && (
                    <ul className={css.acceptanceList}>
                      {task.acceptance.map(item => (
                        <li key={item.criterion} data-status={item.status}>
                          <span className={css.acceptanceMark}>
                            {item.status === 'pass' ? 'PASS' : item.status === 'fail' ? 'FAIL' : t('library.pending')}
                          </span>
                          {item.criterion}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <footer className={css.blocker} data-blocked={team.blocker === undefined ? undefined : true}>
        <span className={css.blockerTitle}>{t('library.blocker')}</span>
        {team.blocker === undefined
          ? <span>{t('library.noBlocker')}</span>
          : <span>{team.blocker.subject}：{team.blocker.reason}</span>}
      </footer>
    </div>
  )
}
