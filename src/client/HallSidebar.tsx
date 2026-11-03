/**
 * 福地侧栏（t17）：顶部导航条 + 铺满的像素活动面板。
 *
 * 用户要求「像素人活动面板完整嵌进右侧栏、铺满宽高，底部跳转栏搬到顶部」：
 * 切页只改右栏内容区（t29）：设施页内容 portal 进 .content 宿主，中间内容区与对话完全不受影响。
 */
import { useEffect, useRef } from 'react'
import type { ActivityTeam } from './activity-monitor.ts'
import type { AgentTeamsLocaleKey, AgentTeamsTranslate } from './locales.ts'
import { HALL_CONTENT_HOST, registerHallHost, type HallPage } from './hall-nav.ts'
import { PLUGIN_VERSION } from './version.ts'
import css from './HallSidebar.module.css'

/** 顶部导航条：原底栏的 6 个入口（经 / 榜 / 山 / 志 / 阁 / ⚙），横排、每项 ≥44 高。 */
const NAV: ReadonlyArray<{ readonly page: HallPage; readonly glyph: string; readonly label: AgentTeamsLocaleKey }> = [
  { page: 'home', glyph: '⌂', label: 'hall.home' },
  { page: 'start', glyph: '＋', label: 'quickstart.entry' },
  { page: 'archive', glyph: '🗄', label: 'office.archive' },
  // 名册固定第二；法脉与总进度互换位置（内容仍随标签）。
  { page: 'teams', glyph: '山', label: 'office.bill' },
  { page: 'about', glyph: '志', label: 'office.floorAbout' },
  { page: 'settings', glyph: '⚙', label: 'office.floorSettings' },
]

export interface HallSidebarProps {
  readonly team?: ActivityTeam
  readonly t: AgentTeamsTranslate
  readonly page?: HallPage
  readonly onOpenPage: (page: HallPage) => void
  readonly onCollapse: () => void
}

export function HallSidebar({ team, t, page, onOpenPage, onCollapse }: HallSidebarProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    registerHallHost(HALL_CONTENT_HOST, contentRef.current)
    return () => { registerHallHost(HALL_CONTENT_HOST, null) }
  }, [])
  const hall: ActivityTeam = team ?? {
    workspace: '',
    teamId: '',
    name: t('office.hallEmptyName'),
    captainSessionId: '',
    phase: 'running',
    members: [],
    tasks: [],
    messageCount: 0,
    captainInbox: [],
  }
  const done = hall.tasks.filter(task => task.status === 'completed').length
  const total = hall.tasks.length
  return (
    <section className={css.panel} data-hall-sidebar data-page={page ?? 'home'} aria-label={t('office.sceneAria', { name: hall.name })}>
      <nav className={css.nav} data-hall-nav aria-label={hall.name} role="toolbar">
        <span className={css.srOnly} data-hall-summary>{hall.name} · {done}/{total} · v{PLUGIN_VERSION}</span>
        <div className={css.navItems}>
          {NAV.map(item => (
            <button
              key={item.page}
              type="button"
              className={css.navItem}
              data-hall-entry={item.page}
              data-active={page === item.page || undefined}
              onClick={() => { onOpenPage(item.page) }}
            >
              <span className={css.navGlyph} aria-hidden>{item.glyph}</span>
              <span className={css.navLabel}>{t(item.label)}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={css.headButton}
          data-control="hall-collapse"
          onClick={onCollapse}
          aria-label={t('office.collapse')}
          title={t('office.collapse')}
        >
          —
        </button>
      </nav>
      {/* 不再渲染像素活动面板：直接展示设施页内容，减少资源占用。 */}
      <div className={css.content} data-hall-content ref={contentRef} />
    </section>
  )
}
