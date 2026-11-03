/** 福地页面/侧栏的 DOM 宿主：右侧栏与 main 槽各挂一个，内容由福地组件 portal 进来。 */
import { useEffect, useRef } from 'react'
import { HALL_SIDEBAR_HOST, registerHallHost, setHallSidebarVisible } from './hall-nav.ts'
import css from './HallSidebar.module.css'

/** 右侧栏里的福地宿主（侧栏标签页顶部）。 */
export function HallSidebarHost() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = ref.current
    registerHallHost(HALL_SIDEBAR_HOST, node)
    if (node === null) return () => { registerHallHost(HALL_SIDEBAR_HOST, null) }

    // 收起成 rail 时宿主不会卸载，只是把整个右栏面板 aria-hidden 并滑出视口；
    // 不把「可见性」报给福地，收起后令牌就永远不会出现（用户报告的「关闭没有令牌」）。
    const panel = node.closest('[data-sidebar-right-panel]')
    const read = (): void => {
      const hidden = panel !== null && panel.getAttribute('aria-hidden') === 'true'
      setHallSidebarVisible(!hidden && node.getClientRects().length > 0)
    }
    read()
    const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(read)
    if (panel !== null) observer?.observe(panel, { attributes: true, attributeFilter: ['aria-hidden', 'data-sidebar-right-open'] })
    // 视口/布局变化（窗口缩放、对话切换）也会让宿主的可见性变化。
    window.addEventListener('resize', read)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', read)
      // 宿主卸载后由「宿主缺席」路径接管兜底，先把可见性复位，避免留下过期状态。
      setHallSidebarVisible(true)
      registerHallHost(HALL_SIDEBAR_HOST, null)
    }
  }, [])
  return <div className={css.host} ref={ref} data-hall-sidebar-host />
}
