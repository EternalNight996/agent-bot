/**
 * 法脉·藏经阁 delivery showcase — the delivered artifacts opened in place.
 *
 * The product rule: a finished team's delivery is shown to the user here, not
 * handed back as "install and run this". HTML pages render in a sandboxed
 * iframe through the plugin's own artifact mount, images render directly, and
 * text/code files render as source; everything else keeps an explicit
 * open-in-a-new-tab escape hatch instead of pretending to preview.
 */
import { useEffect, useMemo, useState } from 'react'
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

export function ShowcasePanel({ sessionId, teamId, teamName, t, onClose }: {
  readonly sessionId: string
  readonly teamId: string
  readonly teamName: string
  readonly t: AgentTeamsTranslate
  readonly onClose: () => void
}) {
  const [view, setView] = useState<ShowcaseView | undefined>()
  const [mount, setMount] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | undefined>()
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [reading, setReading] = useState<string | undefined>()
  const [running, setRunning] = useState(false)
  const [runNotice, setRunNotice] = useState('')

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
    // The translate binding is a stable namespace binder; only the identity of
    // the delivery drives the fetch.
  }, [sessionId, teamId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  const files = useMemo(() => view?.files ?? [], [view])
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
    <div
      className={css.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('showcase.title')}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <section className={css.sheet}>
        <header className={css.head}>
          <span className={css.mark} aria-hidden>▣</span>
          <span className={css.title}>{t('showcase.title')}</span>
          <span className={css.team}>{teamName}</span>
          <span className={css.pill}>{t('showcase.runHint')}</span>
          <button
            type="button"
            className={css.close}
            aria-label={t('showcase.close')}
            title={t('showcase.close')}
            onClick={onClose}
          >
            ✕
          </button>
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
                {selectedUrl !== undefined && (
                  <a className={css.openLink} href={selectedUrl} target="_blank" rel="noreferrer">
                    {t('showcase.openTab')}
                  </a>
                )}
                {runnable && (
                  <button type="button" className={css.runButton} disabled={running} onClick={() => { void runSelected() }}>
                    {running ? t('showcase.running') : selectedAction?.kind === 'preview' ? t('showcase.preview') : t('showcase.run')}
                  </button>
                )}
                {runNotice !== '' && <span className={css.runNotice} role="status">{runNotice}</span>}
              </div>
            )}
            {preview}
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
    </div>
  )
}
