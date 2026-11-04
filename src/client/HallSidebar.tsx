/**
 * 福地侧栏（t17）：顶部导航条 + 铺满的活动区。
 *
 * 导航条改用 antd `Tabs type="card"`（用户指定），保留原有 4 个入口与折叠按钮；
 * 切页只改右栏内容区（t29）：设施页内容 portal 进 .content 宿主，中间内容区与对话完全不受影响。
 */
import { useEffect, useRef } from 'react'
import type * as AntdTypes from 'antd'
// 只引 Tabs / ConfigProvider / theme 三个模块，避免整包 barrel 把全部组件拖进
// 单文件客户端 bundle（实测 barrel 会从 655 KB 涨到 2.7 MB）。antd 的 es 产物
// 是 ESM，但 NodeNext 下 d.ts 的 default 被当成命名空间，这里用类型断言取回
// 官方类型；运行时 bundler 解析的就是它们的 default export。
import TabsModule from 'antd/es/tabs/index.js'
import ConfigProviderModule from 'antd/es/config-provider/index.js'
import themeModule from 'antd/es/theme/index.js'
import type { ActivityTeam } from './activity-monitor.ts'
import type { AgentTeamsLocaleKey, AgentTeamsTranslate } from './locales.ts'
import { HALL_CONTENT_HOST, registerHallHost, type HallPage } from './hall-nav.ts'
import { PLUGIN_VERSION } from './version.ts'
import css from './HallSidebar.module.css'

const Tabs = TabsModule as unknown as typeof AntdTypes.Tabs
const ConfigProvider = ConfigProviderModule as unknown as typeof AntdTypes.ConfigProvider
const theme = themeModule as unknown as typeof AntdTypes.theme

/** 顶部导航条：原底栏的 4 个入口（洪荒 / 账单 / 洪荒纪 / 设置）。 */
const NAV: ReadonlyArray<{ readonly page: HallPage; readonly glyph: string; readonly label: AgentTeamsLocaleKey }> = [
  { page: 'home', glyph: '⌂', label: 'hall.home' },
  // 名册固定第二；法脉与总进度互换位置（内容仍随标签）。
  { page: 'teams', glyph: '山', label: 'office.bill' },
  { page: 'about', glyph: '志', label: 'office.floorAbout' },
  { page: 'settings', glyph: '⚙', label: 'office.floorSettings' },
]

/**
 * 洪荒面板是深色底，antd 默认浅色主题会和整页割裂：这里用暗色算法并把关键
 * token 对齐宿主的 --dsw-alias-* 取值，仅作用于这一条导航。
 */
const ANTD_THEME = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#6fb6ff',
    colorBgContainer: '#151a21',
    colorBorder: '#2c3442',
    colorBorderSecondary: '#222a35',
    colorText: '#e8eef6',
    colorTextSecondary: '#9aa4b2',
    borderRadius: 8,
    fontSize: 15,
  },
  components: {
    Tabs: {
      cardBg: '#151a21',
      cardHeight: 60,
      cardPadding: '16px 24px',
      itemColor: '#9aa4b2',
      itemSelectedColor: '#6fb6ff',
      itemHoverColor: '#d6ecff',
    },
  },
} as const

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
        <ConfigProvider theme={ANTD_THEME}>
          <Tabs
            type="card"
            className={css.antdNav}
            activeKey={page ?? 'home'}
            onChange={key => { onOpenPage(key as HallPage) }}
            tabBarExtraContent={(
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
            )}
            items={NAV.map(item => ({
              key: item.page,
              label: (
                <span className={css.navItem} data-hall-entry={item.page}>
                  <span className={css.navGlyph} aria-hidden>{item.glyph}</span>
                  <span className={css.navLabel}>{t(item.label)}</span>
                </span>
              ),
            }))}
          />
        </ConfigProvider>
      </nav>
      {/* 不再渲染像素活动面板：直接展示设施页内容，减少资源占用。 */}
      <div className={css.content} data-hall-content ref={contentRef} />
    </section>
  )
}
