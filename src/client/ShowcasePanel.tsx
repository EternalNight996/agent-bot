/**
 * 交付产物查看器：文件列表 + 就地预览 + 可选运行。
 *
 * 同一个 body 有两种外壳：
 *  · ShowcaseBody({ docked }) —— 驱动网关：右侧栏里的常驻视图（不再是弹窗）；
 *  · ShowcasePanel —— 旧的全屏弹窗外壳，保留给需要独立弹层的调用方。
 *
 * 产品规则不变：产物在这里被展示/运行，而不是把命令丢给用户。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import css from './ShowcasePanel.module.css'
import type { AgentTeamsTranslate } from './locales.ts'
import type { ShowcaseFile, ShowcaseView } from '../showcase-model.ts'

interface ShowcaseResponse extends ShowcaseView {
  readonly ok?: boolean
  readonly error?: string
  readonly mount?: string
}

const KIND_ICON: Readonly<Record<string, string>> = {
  html: '▣',
  image: '🖼',
  markdown: '📜',
  text: '📄',
  code: '⌨',
  pdf: '📕',
  video: '🎬',
  audio: '🔊',
  other: '📦',
}

function artifactUrl(mount: string, path: string): string {
  return mount + path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function fileName(path: string): string {
  const segments = path.split('/')
  return segments[segments.length - 1] ?? path
}

function directoryOf(path: string): string {
  const index = path.lastIndexOf('/')
  return index <= 0 ? '' : path.slice(0, index)
}

function isTextPreview(file: ShowcaseFile): boolean {
  return file.kind === 'markdown' || file.kind === 'text' || file.kind === 'code'
}

export function ShowcaseBody({ sessionId, teamId, teamName, t, title, docked = false, onClose, onOpenWindow, onReveal }: {
  readonly sessionId: string
  readonly teamId: string
  readonly teamName?: string
  readonly t: AgentTeamsTranslate
  /** 标题：驱动网关 / 交付结果。 */
  readonly title?: string
  /** 由右侧栏承载：铺满面板，不画弹窗边框与关闭按钮。 */
  readonly docked?: boolean
  readonly onClose?: () => void
  /**
   * 「新窗口打开」交给宿主：桌面端会拦截 window.open（dsh-app:// 不在
   * setWindowOpenHandler 的 http/https 白名单里），所以由调用方用
   * sidebarRight.openResource 在右栏新开一个文件标签。
   */
  readonly onOpenWindow?: (workspacePath: string) => void
  /**
   * 「打开目标文件夹」：由宿主 Session Remote 在系统文件管理器中显示该文件。
   * 返回空串表示成功，否则是一段可展示的原因。
   */
  readonly onReveal?: (workspacePath: string) => Promise<string>
}) {
  const [view, setView] = useState<ShowcaseView | undefined>()
  const [mount, setMount] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | undefined>()
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [reading, setReading] = useState<string | undefined>()
  const [running, setRunning] = useState(false)
  const [runNotice, setRunNotice] = useState('')
  // 预览区缩放/平移：iframe 内容跨源不可直接缩放，改为对承载层做 transform；
  // 放大后盖一层透明拖拽层，左键长按即可拖动视野（此时报告内链接让位于平移）。
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [ctrlHeld, setCtrlHeld] = useState(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const panDrag = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null)

  const clampZoom = (value: number): number => Math.min(4, Math.max(0.5, Math.round(value * 100) / 100))
  const zoomBy = (delta: number): void => { setZoom(current => clampZoom(current + delta)) }
  const resetView = (): void => { setZoom(1); setPan({ x: 0, y: 0 }) }

  // 换文件回到 100%，避免带着上一张图的缩放看新文件。
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [selected])

  // Ctrl 按住时在 iframe 上盖一层透明层，滚动事件才会落到本组件做缩放。
  useEffect(() => {
    const down = (event: KeyboardEvent): void => { if (event.key === 'Control') setCtrlHeld(true) }
    const up = (event: KeyboardEvent): void => { if (event.key === 'Control') setCtrlHeld(false) }
    const blur = (): void => { setCtrlHeld(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) return
      event.preventDefault()
      setZoom(current => clampZoom(current + (event.deltaY < 0 ? 0.1 : -0.1)))
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => { viewport.removeEventListener('wheel', onWheel) }
  }, [])

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button, a') !== null) return
    // 拖拽视野时不要顺带选中 iframe 元素或正文。
    event.preventDefault()
    panDrag.current = { x: event.clientX, y: event.clientY, baseX: pan.x, baseY: pan.y }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer already gone */ }
  }
  const movePan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = panDrag.current
    if (drag === null) return
    setPan({ x: drag.baseX + (event.clientX - drag.x), y: drag.baseY + (event.clientY - drag.y) })
  }
  const endPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (panDrag.current === null) return
    panDrag.current = null
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* already released */ }
  }
  const revealFolder = async (): Promise<void> => {
    if (selectedFile === undefined || onReveal === undefined) return
    const message = await onReveal(selectedFile.path)
    setRunNotice(message === '' ? t('showcase.revealed') : t('showcase.revealFailed') + ' · ' + message)
  }

  useEffect(() => {
    let cancelled = false
    const query = '/plugins/dsh-super-agent/showcase?sessionId=' + encodeURIComponent(sessionId)
      + '&teamId=' + encodeURIComponent(teamId)
    void fetch(query)
      .then(async response => {
        const body = await response.json() as ShowcaseResponse
        if (cancelled) return
        if (!response.ok || body.error !== undefined) {
          setError(body.error ?? 'HTTP ' + response.status)
          return
        }
        setView(body)
        setMount(typeof body.mount === 'string' ? body.mount : '')
        setSelected(body.entry ?? body.files[0]?.path)
      })
      .catch(() => { if (!cancelled) setError(t('showcase.failed')) })
    return () => { cancelled = true }
    // The translate binding is a stable namespace binder; only the delivery
    // identity drives the fetch.
  }, [sessionId, teamId])

  const files = useMemo(() => view?.files ?? [], [view])
  const shownTeam = teamName ?? view?.teamName
  const selectedFile = useMemo(() => files.find(file => file.path === selected), [files, selected])
  const selectedUrl = selectedFile === undefined ? undefined : artifactUrl(mount, selectedFile.path)
  const selectedAction = selectedFile === undefined ? undefined : view?.actions?.find(action => action.path === selectedFile.path)
  const runnable = selectedAction !== undefined
  const runSelected = async (): Promise<void> => {
    if (selectedFile === undefined) return
    setRunning(true)
    setRunNotice('')
    try {
      const response = await fetch('/plugins/dsh-super-agent/showcase/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, teamId, path: selectedFile.path }),
      })
      const body = await response.json() as { ok?: boolean; preview?: boolean; pid?: number; error?: string }
      if (!response.ok || body.ok !== true) throw new Error(body.error ?? 'HTTP ' + response.status)
      setRunNotice(body.preview === true ? t('showcase.previewOnly') : t('showcase.launched', { pid: body.pid ?? '—' }))
    } catch (error) {
      setRunNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (selectedFile === undefined || !isTextPreview(selectedFile)) return
    if (mount === '') return
    if (texts[selectedFile.path] !== undefined) return
    let cancelled = false
    setReading(selectedFile.path)
    void fetch(artifactUrl(mount, selectedFile.path))
      .then(async response => (response.ok ? response.text() : Promise.reject(new Error('HTTP ' + response.status))))
      .then(body => {
        if (cancelled) return
        setTexts(previous => ({ ...previous, [selectedFile.path]: body.length > 400_000 ? body.slice(0, 400_000) : body }))
      })
      .catch(() => {
        if (!cancelled) setTexts(previous => ({ ...previous, [selectedFile.path]: t('showcase.readFailed') }))
      })
      .finally(() => { if (!cancelled) setReading(undefined) })
    return () => { cancelled = true }
  }, [selectedFile, mount, texts])

  const preview = (() => {
    if (view === undefined) {
      return error === '' ? <p className={css.placeholder}>{t('showcase.loading')}</p> : <p className={css.error}>{error}</p>
    }
    if (files.length === 0) return <p className={css.placeholder}>{t('showcase.empty')}</p>
    if (selectedFile === undefined || selectedUrl === undefined) return <p className={css.placeholder}>{t('showcase.pick')}</p>
    switch (selectedFile.kind) {
      case 'html':
        return (
          <div className={css.frameWrap}>
            <iframe
              className={css.frame}
              title={selectedFile.path}
              src={selectedUrl}
              sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
              referrerPolicy="no-referrer"
            />
          </div>
        )
      case 'image':
        return (
          <div className={css.imageWrap}>
            <img className={css.image} src={selectedUrl} alt={fileName(selectedFile.path)} />
          </div>
        )
      case 'pdf':
        return (
          <div className={css.frameWrap}>
            <iframe className={css.frame} title={selectedFile.path} src={selectedUrl} />
          </div>
        )
      case 'video':
        return (
          <div className={css.imageWrap}>
            <video className={css.image} controls src={selectedUrl} />
          </div>
        )
      case 'audio':
        return (
          <div className={css.imageWrap}>
            <audio controls src={selectedUrl} />
          </div>
        )
      default:
        return (
          <pre className={css.code}>
            {texts[selectedFile.path] ?? (reading === selectedFile.path ? t('showcase.reading') : t('showcase.noPreview'))}
          </pre>
        )
    }
  })()

  return (
    <section className={docked ? css.docked : css.sheet} aria-label={title ?? t('showcase.title')}>
      <header className={css.head}>
        <span className={css.mark} aria-hidden>▣</span>
        <span className={css.title}>{title ?? t('showcase.title')}</span>
        {shownTeam !== undefined && shownTeam !== '' && <span className={css.team}>{shownTeam}</span>}
        <span className={css.pill}>{t('showcase.runHint')}</span>
        {!docked && onClose !== undefined && (
          <button
            type="button"
            className={css.close}
            aria-label={t('showcase.close')}
            title={t('showcase.close')}
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </header>
      <div className={css.body}>
        <aside className={css.files} aria-label={t('showcase.files', { count: files.length })}>
          {files.map(file => (
            <button
              key={file.path}
              type="button"
              className={css.file}
              aria-current={file.path === selected}
              title={file.path}
              onClick={() => { setSelected(file.path) }}
            >
              <span className={css.fileIcon} aria-hidden>{KIND_ICON[file.kind] ?? '📦'}</span>
              <span className={css.fileBody}>
                <span className={css.fileName}>{fileName(file.path)}</span>
                {directoryOf(file.path) !== '' && <span className={css.fileDir}>{directoryOf(file.path)}</span>}
              </span>
              {file.entry && <span className={css.badge}>{t('showcase.entry')}</span>}
              <span className={css.fileMeta}>{formatSize(file.size)}</span>
            </button>
          ))}
        </aside>
        <div className={css.preview}>
          {selectedFile !== undefined && (
            <div className={css.previewBar}>
              <span className={css.previewPath} title={selectedFile.path}>{selectedFile.path}</span>
              {selectedUrl !== undefined && onReveal !== undefined && (
                <button
                  type="button"
                  className={css.openLink}
                  title={t('showcase.revealHint')}
                  onClick={() => { void revealFolder() }}
                >
                  {t('showcase.reveal')}
                </button>
              )}
              {selectedUrl !== undefined && (
                <button
                  type="button"
                  className={css.openLink}
                  title={selectedFile.path}
                  onClick={() => {
                    if (onOpenWindow !== undefined) {
                      onOpenWindow(selectedFile.path)
                      return
                    }
                    // 旧弹窗外壳没有宿主右栏可借用：保留浏览器新窗口兜底。
                    try { window.open(selectedUrl, '_blank', 'noopener') } catch { /* blocked */ }
                  }}
                >
                  {t('showcase.openTab')}
                </button>
              )}
              {runnable && (
                <button type="button" className={css.runButton} disabled={running} onClick={() => { void runSelected() }}>
                  {running ? t('showcase.running') : selectedAction?.kind === 'preview' ? t('showcase.preview') : t('showcase.run')}
                </button>
              )}
              <span className={css.zoomGroup}>
                <button type="button" className={css.zoomButton} title={t('showcase.zoomOut')} onClick={() => { zoomBy(-0.1) }}>−</button>
                <button type="button" className={css.zoomButton} data-zoom={zoom} title={t('showcase.zoomReset')} onClick={resetView}>{Math.round(zoom * 100)}%</button>
                <button type="button" className={css.zoomButton} title={t('showcase.zoomIn')} onClick={() => { zoomBy(0.1) }}>＋</button>
              </span>
              {runNotice !== '' && <span className={css.runNotice} role="status">{runNotice}</span>}
            </div>
          )}
          <div
            ref={viewportRef}
            className={css.viewport}
            data-zoomed={zoom !== 1 || undefined}
            onPointerDown={beginPan}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <div className={css.zoomLayer} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              {preview}
            </div>
            {(zoom !== 1 || ctrlHeld) && <div className={css.panShield} aria-hidden />}
          </div>
        </div>
      </div>
      <footer className={css.foot}>
        {view?.projectRoot !== undefined && (
          <span className={css.root}>{t('showcase.root')} {view.projectRoot}</span>
        )}
        <span>{t('showcase.files', { count: files.length })}</span>
        {view?.truncated === true && <span>{t('showcase.truncated')}</span>}
        <span className={css.footHint}>{t('showcase.runHint')}</span>
      </footer>
    </section>
  )
}

/** 旧的全屏弹窗外壳；页面里优先使用右侧栏的驱动网关。 */
export function ShowcasePanel({ sessionId, teamId, teamName, t, onClose }: {
  readonly sessionId: string
  readonly teamId: string
  readonly teamName: string
  readonly t: AgentTeamsTranslate
  readonly onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [onClose])
  return (
    <div
      className={css.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('showcase.title')}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <ShowcaseBody sessionId={sessionId} teamId={teamId} teamName={teamName} t={t} onClose={onClose} />
    </div>
  )
}
