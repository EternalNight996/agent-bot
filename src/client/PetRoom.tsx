/** 养成宠物页：小肥鱼的状态、互动和成长。 */
import { useEffect, useState } from 'react'
import type { AgentTeamsTranslate } from './locales.ts'
import { PET_ART } from './pet-art.ts'
import { levelOf, petSpeech, stageOf, type PetStage } from '../pet-model.ts'
import { feed, pat, play, rest, syncTasks, tickPetNow, usePet } from './pet-store.ts'
import css from './PetRoom.module.css'

type ActionKind = 'feed' | 'pat' | 'play' | 'rest'

const STAGE_KEY: Record<PetStage, 'pet.stage.fry' | 'pet.stage.small' | 'pet.stage.fat' | 'pet.stage.whale'> = {
  fry: 'pet.stage.fry',
  small: 'pet.stage.small',
  fat: 'pet.stage.fat',
  whale: 'pet.stage.whale',
}

const SPEECH_KEY = {
  hungry: 'pet.speech.hungry',
  bored: 'pet.speech.bored',
  sleepy: 'pet.speech.sleepy',
  happy: 'pet.speech.happy',
} as const

function StatBar({ label, value, tone }: { readonly label: string; readonly value: number; readonly tone: 'satiety' | 'mood' | 'energy' }) {
  return (
    <div className={css.statRow} data-tone={tone}>
      <span className={css.statLabel}>{label}</span>
      <span className={css.statTrack} aria-hidden><i style={{ width: value + '%' }} /></span>
      <span className={css.statValue}>{value}</span>
    </div>
  )
}

export function PetRoom({ t, completedTasks }: { readonly t: AgentTeamsTranslate; readonly completedTasks: number }) {
  const pet = usePet()
  const [message, setMessage] = useState('')
  const level = levelOf(pet.xp)
  const stage = stageOf(level.level)
  const speech = petSpeech(pet)

  useEffect(() => {
    tickPetNow()
    const timer = window.setInterval(() => { tickPetNow() }, 30_000)
    return () => { window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    syncTasks(completedTasks)
  }, [completedTasks])

  const act = (kind: ActionKind): void => {
    const result = kind === 'feed' ? feed() : kind === 'play' ? play() : kind === 'pat' ? pat() : rest()
    if (result.ok) {
      setMessage(t(('pet.feedback.' + kind) as Parameters<typeof t>[0]))
      return
    }
    setMessage(t(('pet.feedback.' + (result.reason ?? 'cooldown')) as Parameters<typeof t>[0]))
  }

  const progress = level.need === 0 ? 100 : Math.round((level.into / level.need) * 100)

  return (
    <section className={css.room} data-control="pet-room">
      <header className={css.head}>
        <div className={css.identity}>
          <strong className={css.name}>{pet.name}</strong>
          <span className={css.stage}>{t(STAGE_KEY[stage])} · {t('pet.level', { level: level.level })}</span>
        </div>
        <span className={css.taskBadge}>{t('pet.taskXp', { count: pet.lastTaskCount })}</span>
      </header>

      <div className={css.tank} data-stage={stage}>
        <span className={css.bubble} aria-hidden />
        <span className={css.bubble} aria-hidden />
        <span className={css.bubble} aria-hidden />
        <div className={css.speech} data-speech={speech}>{t(SPEECH_KEY[speech])}</div>
        <img className={css.fish} src={PET_ART} alt="" draggable={false} />
        <span className={css.shadow} aria-hidden />
      </div>

      <div className={css.stats}>
        <StatBar label={t('pet.satiety')} value={pet.satiety} tone="satiety" />
        <StatBar label={t('pet.mood')} value={pet.mood} tone="mood" />
        <StatBar label={t('pet.energy')} value={pet.energy} tone="energy" />
      </div>

      <div className={css.xpRow}>
        <span className={css.xpLabel}>{t('pet.growth')}</span>
        <span className={css.xpTrack} aria-hidden><i style={{ width: progress + '%' }} /></span>
        <span className={css.xpValue}>{level.into} / {level.need}</span>
      </div>

      <div className={css.actions}>
        <button type="button" className={css.action} onClick={() => { act('feed') }}>🍚 {t('pet.feed')}</button>
        <button type="button" className={css.action} onClick={() => { act('pat') }}>🤚 {t('pet.pat')}</button>
        <button type="button" className={css.action} onClick={() => { act('play') }}>🎾 {t('pet.play')}</button>
        <button type="button" className={css.action} onClick={() => { act('rest') }}>😴 {t('pet.rest')}</button>
      </div>

      {message !== '' && <p className={css.message} role="status">{message}</p>}
      <p className={css.hint}>{t('pet.hint')}</p>
    </section>
  )
}
