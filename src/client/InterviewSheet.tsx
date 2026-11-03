/** Dynamic AI interview: template-like questions generated from the requirement. */
import { useState } from 'react'
import css from './InterviewSheet.module.css'
import type { TeamMode } from '../modes.ts'
import { getModeSpec } from '../modes.ts'
import type { AgentTeamsTranslate } from './locales.ts'

export interface InterviewQuestionView {
  id: string
  prompt: string
  multi: boolean
  options: string[]
}

export function InterviewSheet({ questions, answers, onChange, state, error, mode, disabled, onRetry, t }: {
  readonly questions: readonly InterviewQuestionView[]
  readonly answers: Readonly<Record<string, string[]>>
  readonly onChange: (next: Record<string, string[]>) => void
  readonly state: 'loading' | 'ready' | 'fallback'
  readonly error: string
  readonly mode: TeamMode
  readonly disabled?: boolean
  readonly onRetry: () => void
  readonly t: AgentTeamsTranslate
}) {
  const [custom, setCustom] = useState<Record<string, string>>({})
  const spec = getModeSpec(mode)
  const setAnswer = (id: string, values: string[]): void => { onChange({ ...answers, [id]: values }) }
  const toggle = (id: string, value: string, multi: boolean): void => {
    const current = answers[id] ?? []
    if (multi) {
      setAnswer(id, current.includes(value) ? current.filter(item => item !== value) : [...current, value])
      return
    }
    // Single-select options must be deselectable: clicking the active card clears it.
    setAnswer(id, current.includes(value) ? [] : [value])
  }
  const addCustom = (id: string): void => {
    const value = (custom[id] ?? '').trim()
    if (value === '') return
    setAnswer(id, [...new Set([...(answers[id] ?? []), value])])
    setCustom(current => ({ ...current, [id]: '' }))
  }
  return (
    <div className={css.root} data-step="interview">
      <div className={css.topline}>
        <p className={css.modeBadge} style={{ color: spec.color, borderColor: spec.color }}>{spec.emoji} {t(spec.labelKey as Parameters<typeof t>[0])}</p>
        <p className={css.aiNote} data-state={state}>
          {state === 'loading' ? t('interview.loading') : state === 'fallback' ? t('interview.fallback') : t('interview.hint')}
        </p>
      </div>
      {error !== '' && <p className={css.error} role="alert">{error}</p>}
      {state === 'loading' && <p className={css.loading}>{t('interview.loadingHint')}</p>}
      {state !== 'loading' && questions.map((question, index) => {
        const selected = answers[question.id] ?? []
        return (
          <section key={question.id} className={css.block} data-answered={selected.length > 0 || undefined}>
            <div className={css.promptRow}>
              <span className={css.questionNo}>{String(index + 1).padStart(2, '0')}</span>
              <span className={css.prompt}>
                {question.prompt}
                <em>{question.multi ? t('interview.multi') : t('interview.single')}</em>
              </span>
              {selected.length > 0 && <span className={css.selectedCount}>{t('interview.selected', { count: selected.length })}</span>}
            </div>
            <div className={css.options} data-multi={question.multi}>
              {question.options.map(option => {
                const active = selected.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    className={css.option}
                    data-active={active || undefined}
                    disabled={disabled}
                    aria-pressed={active}
                    onClick={() => { toggle(question.id, option, question.multi) }}
                  >
                    <span className={css.optionMark} aria-hidden>{active ? '✓' : ''}</span>
                    <span className={css.optionText}>{option}</span>
                  </button>
                )
              })}
              {selected.filter(value => !question.options.includes(value)).map(value => (
                <button
                  key={value}
                  type="button"
                  className={css.option}
                  data-active
                  disabled={disabled}
                  onClick={() => { setAnswer(question.id, selected.filter(item => item !== value)) }}
                >
                  <span className={css.optionMark} aria-hidden>✓</span>
                  <span className={css.optionText}>{value}</span>
                  <span className={css.optionRemove} aria-hidden>×</span>
                </button>
              ))}
            </div>
            <div className={css.customRow}>
              <input
                className={css.input}
                value={custom[question.id] ?? ''}
                disabled={disabled}
                placeholder={t('interview.customPlaceholder')}
                onChange={(event) => { setCustom(current => ({ ...current, [question.id]: event.target.value })) }}
                onBlur={() => { addCustom(question.id) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); addCustom(question.id) }
                }}
              />
              <button
                type="button"
                className={css.addCustom}
                disabled={disabled || (custom[question.id] ?? '').trim() === ''}
                onClick={() => { addCustom(question.id) }}
              >
                +
              </button>
            </div>
          </section>
        )
      })}
      {state === 'fallback' && (
        <button type="button" className={css.retry} disabled={disabled} onClick={onRetry}>{t('interview.retry')}</button>
      )}
    </div>
  )
}
