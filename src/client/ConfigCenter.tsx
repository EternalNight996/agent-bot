/** 皮肤 / 角色 / 阵容 three-layer configuration center. */
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { AgentTeamsTranslate } from './locales.ts'
import { CAPTAIN_SKIN_OPTIONS, setCaptainSkin, useCaptainSkin } from './captain-skin.ts'
import { ALL_SKINS, type SkinDefinition } from './skins.ts'
import { AGENCY_ROLES, agencyRole, type AgencyRole } from '../agency-roles-lite.ts'
import { PRIMARY_MODES, getModeSpec } from '../modes.ts'
import { modeLineup } from './mode-lineups.ts'
import { addCustomAgencyRole, removeCustomAgencyRole, useCustomAgencyRoles, type CustomAgencyRole } from './custom-agency-roles.ts'
import { hideAgencyRole, showAgencyRole, useHiddenAgencyRoles } from './hidden-agency-roles.ts'
import {
  addLineupEntry, createLineup, deleteLineup, removeLineupEntry, resetLineup, useLineups,
  type LineupDefinition,
} from './lineup-store.ts'
import { hideLineup, showLineup, useHiddenLineups } from './hidden-lineups.ts'
import { setRoleAgent as saveRoleAgent, useRoleAgents } from './role-agents.ts'
import { setRolePrompt as saveRolePrompt, useRolePrompts } from './role-prompts.ts'
import { addCustomSkin, removeCustomSkin, useCustomSkins, type CustomSkin } from './custom-skins.ts'
import { hideSkin, showSkin, useHiddenSkins } from './hidden-skins.ts'
import css from './ConfigCenter.module.css'

type Tab = 'skins' | 'roles' | 'lineups'
type Confirm = { readonly kind: 'lineup' | 'skin'; readonly id: string; readonly name: string; readonly x: number; readonly y: number }

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('image read failed'))
    reader.readAsDataURL(file)
  })
}

function rolePromptText(role: { name: string; category: string; skills: readonly string[]; executor: string }, agent: string): string {
  return [
    '你是 ' + role.name + '（' + role.category + '）。',
    '核心技能：' + role.skills.join('、') + '。',
    '执行 Agent：' + agent + '。',
    '任务执行类型：' + role.executor + '。',
    '工作方式：先确认任务契约与边界，再按技能完成交付；只产出证据，不越权替其他角色决策。',
  ].join('\n')
}

export function ConfigCenter({ t, sessionId, onFeedback }: { readonly t: AgentTeamsTranslate; readonly sessionId?: string; readonly onFeedback?: () => void }): ReactElement {
  const [tab, setTab] = useState<Tab>('skins')
  const captainSkin = useCaptainSkin()
  const lineups = useLineups()
  const hiddenLineups = useHiddenLineups()
  const agents = useRoleAgents()
  const prompts = useRolePrompts()
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({})
  const customSkins = useCustomSkins()
  const hiddenSkins = useHiddenSkins()
  const [expandedLineup, setExpandedLineup] = useState<string | undefined>()
  const [expandedRole, setExpandedRole] = useState<string | undefined>()
  // Expert prompt bodies are host-only (~1 MB); fetch just the one being opened.
  const [catalogPrompts, setCatalogPrompts] = useState<Record<string, string>>({})
  useEffect(() => {
    if (expandedRole === undefined || catalogPrompts[expandedRole] !== undefined) return
    const roleId = expandedRole
    let cancelled = false
    void fetch('/plugins/dsh-super-agent/role-prompt?roleId=' + encodeURIComponent(roleId))
      .then(response => (response.ok ? response.json() : null))
      .then((body: { prompt?: unknown } | null) => {
        if (cancelled || typeof body?.prompt !== 'string') return
        const prompt = body.prompt
        setCatalogPrompts(current => ({ ...current, [roleId]: prompt }))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [expandedRole, catalogPrompts])
  const [defaultLineup, setDefaultLineup] = useState<string>(() => {
    try { return window.localStorage.getItem('dsh-super-agent.lastFaction') ?? 'pilgrim' } catch { return 'pilgrim' }
  })
  const [confirm, setConfirm] = useState<Confirm | undefined>()
  const [creatingLineup, setCreatingLineup] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTheme, setNewTheme] = useState('')
  const [creatingSkin, setCreatingSkin] = useState(false)
  const [polishing, setPolishing] = useState('')
  const customRoles = useCustomAgencyRoles()
  const hiddenRoles = useHiddenAgencyRoles()
  const allRoles: readonly (AgencyRole | CustomAgencyRole)[] = [...AGENCY_ROLES.filter(role => !hiddenRoles.includes(role.id)), ...customRoles]
  const [roleCreating, setRoleCreating] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [roleSkills, setRoleSkills] = useState('')
  const [roleExecutor, setRoleExecutor] = useState('implementer')
  const [roleAgent, setRoleAgent] = useState('dsh')
  const [rolePrompt, setRolePrompt] = useState('')
  const [skinName, setSkinName] = useState('')
  const [skinArt, setSkinArt] = useState('')
  const [skinBackground, setSkinBackground] = useState('#2a2418')
  const [skinTheme, setSkinTheme] = useState('')
  const [draftRole, setDraftRole] = useState(AGENCY_ROLES[0]?.id ?? '')
  const [draftSkin, setDraftSkin] = useState(ALL_SKINS[0]?.id ?? '')

  const skins: SkinDefinition[] = useMemo(() => [
    ...ALL_SKINS.filter(skin => !hiddenSkins.includes(skin.id)),
    ...customSkins.map((skin: CustomSkin) => ({ ...skin })),
  ], [customSkins, hiddenSkins])
  const skinMap = useMemo(() => new Map(skins.map(skin => [skin.id, skin])), [skins])
  const visibleLineups = lineups.filter(lineup => !hiddenLineups.includes(lineup.id))

  const polishCopy = async (text: string, key: string, apply: (value: string) => void): Promise<void> => {
    if (sessionId === undefined || text.trim() === '') return
    setPolishing(key)
    try {
      const response = await fetch('/plugins/dsh-super-agent/polish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, requirement: text, mode: 'draft' }),
      })
      const body = await response.json() as { expanded?: unknown }
      if (response.ok && typeof body.expanded === 'string' && body.expanded.trim() !== '') apply(body.expanded.trim())
    } catch { /* optional polish */ } finally { setPolishing('') }
  }

  const deleteConfirmed = (): void => {
    if (confirm === undefined) return
    if (confirm.kind === 'lineup') {
      const lineup = lineups.find(item => item.id === confirm.id)
      if (lineup?.builtin === true) hideLineup(confirm.id)
      else deleteLineup(confirm.id)
    } else {
      const builtin = ALL_SKINS.some(skin => skin.id === confirm.id)
      if (builtin) hideSkin(confirm.id)
      else removeCustomSkin(confirm.id)
    }
    setConfirm(undefined)
  }

  return (
    <div className={css.root}>
      <div className={css.tabs} role="tablist">
        {([['skins', 'office.settingsTabSkin'], ['roles', 'office.settingsTabRoles'], ['lineups', 'office.settingsTabLineups']] as const).map(([id, key]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={css.tab} data-active={tab === id || undefined} onClick={() => { setTab(id); setConfirm(undefined) }}>
            {t(key)}
          </button>
        ))}
        {onFeedback !== undefined && (
          <button type="button" className={css.feedbackButton} onClick={onFeedback}>{t('office.exceptionFeedback')}</button>
        )}
      </div>

      {tab === 'skins' && (
        <div className={css.list}>
          <div className={css.sectionHead}>
            <p className={css.hint}>{t('office.skinHint')}</p>
            <button type="button" className={css.button} data-control="skin-create-top" onClick={() => { setCreatingSkin(true) }}>{t('office.skinCreate')}</button>
          </div>
          <div className={css.skinGrid} data-control="captain-skins">
            {CAPTAIN_SKIN_OPTIONS.map(option => (
              <button key={option.id} type="button" className={css.skinCard} data-active={captainSkin.id === option.id || undefined} onClick={() => { setCaptainSkin(option.id) }}>
                <img className={css.skinArt} src={option.art} alt="" aria-hidden />
                <span>{option.name}</span>
              </button>
            ))}
          </div>
          <p className={css.hint}>{t('office.skinCatalogHint')}</p>
          <div className={css.skinCatalog}>
            {skins.map(skin => (
              <div key={skin.id} className={css.skinTileWrap}>
                <div className={css.skinTile} style={{ background: skin.background }}>
                  <img src={skin.art} alt="" aria-hidden />
                  <strong>{skin.name}</strong>
                  <small>{skin.theme}</small>
                </div>
                <button type="button" className={css.tileDelete} title={t('office.delete')} onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  setConfirm({ kind: 'skin', id: skin.id, name: skin.name, x: rect.left + rect.width / 2, y: rect.top })
                }}>×</button>
              </div>
            ))}
          </div>
          {hiddenSkins.length > 0 && (
            <div className={css.hiddenBlock}>
              <p className={css.hint}>{t('office.skinHidden')}</p>
              {ALL_SKINS.filter(skin => hiddenSkins.includes(skin.id)).map(skin => (
                <div key={skin.id} className={css.hiddenRow}>
                  <span>{skin.name}</span>
                  <button type="button" className={css.button} onClick={() => { showSkin(skin.id) }}>{t('office.lineupRestore')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'roles' && (
        <div className={css.list}>
          <div className={css.sectionHead}>
            <p className={css.hint}>{t('office.roleCatalogHint')}</p>
            <button type="button" className={css.button} onClick={() => { setRoleCreating(true) }}>{t('office.roleNew')}</button>
          </div>
          {allRoles.map((role, index) => {
            const open = expandedRole === role.id
            const agent = agents[role.id] ?? role.agent
            const prompt = promptDrafts[role.id] ?? prompts[role.id] ?? catalogPrompts[role.id] ?? rolePromptText(role, agent)
            return (
              <section key={role.id} className={css.row}>
                <button type="button" className={css.rowToggle} aria-expanded={open} onClick={() => { setExpandedRole(open ? undefined : role.id) }}>
                  <span><span className={css.rowNo} aria-hidden>{String(index + 1).padStart(2, '0')}</span><strong>{role.name}</strong><small className={css.badge}>{role.category}</small></span>
                  <span className={css.rowChevron}>{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <div className={css.expanded}>
                    <p className={css.meta}>{role.skills.join(' · ')}</p>
                    <label className={css.agentRow}>
                      <span>{t('office.roleAgent')}</span>
                      <select value={agent} onChange={(event) => { saveRoleAgent(role.id, event.target.value) }}>
                        <option value="dsh">dsh</option>
                        <option value="codex">codex</option>
                      </select>
                    </label>
                    <p className={css.promptLabel}>{t('office.rolePromptFull')}</p>
                    <textarea className={css.promptEditor} rows={6} value={prompt} onChange={(event) => { setPromptDrafts(current => ({ ...current, [role.id]: event.target.value })) }} />
                    <div className={css.actions}>
                      <button type="button" className={css.button} onClick={() => { saveRolePrompt(role.id, prompt); setPromptDrafts(current => ({ ...current, [role.id]: prompt })) }}>{t('office.rolePromptSave')}</button>
                      {prompts[role.id] !== undefined && <button type="button" className={css.button} onClick={() => { saveRolePrompt(role.id, ''); setPromptDrafts(current => ({ ...current, [role.id]: catalogPrompts[role.id] || rolePromptText(role, agent) })) }}>{t('office.rolePromptReset')}</button>}
                      {customRoles.some(entry => entry.id === role.id)
                        ? <button type="button" className={css.danger} onClick={() => {
                          for (const lineup of lineups) {
                            const index = lineup.entries.findIndex(entry => entry.role === role.id)
                            if (index >= 0) removeLineupEntry(lineup.id, index)
                          }
                          removeCustomAgencyRole(role.id)
                        }}>{t('office.customRoleDelete')}</button>
                        : <button type="button" className={css.danger} onClick={() => {
                          for (const lineup of lineups) {
                            const index = lineup.entries.findIndex(entry => entry.role === role.id)
                            if (index >= 0) removeLineupEntry(lineup.id, index)
                          }
                          hideAgencyRole(role.id)
                        }}>{t('office.delete')}</button>}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
          {hiddenRoles.length > 0 && (
            <section className={css.row}>
              <div className={css.rowHead}><strong>{t('office.roleHidden')}</strong></div>
              {hiddenRoles.map(id => (
                <div key={id} className={css.hiddenRow}>
                  <span>{agencyRole(id)?.name ?? id}</span>
                  <button type="button" className={css.button} onClick={() => { showAgencyRole(id) }}>{t('office.roleRestore')}</button>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === 'lineups' && (
        <div className={css.list}>
          <div className={css.sectionHead}>
            <p className={css.hint}>{t('office.lineupConfigHint')}</p>
            <button type="button" className={css.button} onClick={() => { setCreatingLineup(true) }}>{t('office.lineupNew')}</button>
          </div>
          {visibleLineups.map((lineup: LineupDefinition, index: number) => {
            const open = expandedLineup === lineup.id
            return (
              <section key={lineup.id} className={css.row}>
                <button type="button" className={css.rowToggle} aria-expanded={open} onClick={() => { setExpandedLineup(open ? undefined : lineup.id) }}>
                  <span><span className={css.rowNo} aria-hidden>{String(index + 1).padStart(2, '0')}</span><strong>{lineup.name}</strong><small className={css.badge}>{lineup.entries.length}</small></span>
                  <span className={css.rowChevron}>{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <div className={css.expanded}>
                    <p className={css.meta}>{lineup.theme}</p>
                    <div className={css.entries}>
                      {lineup.entries.map((entry, index) => {
                        const skin = skinMap.get(entry.skin)
                        return (
                          <span key={entry.role + ':' + index} className={css.entry}>
                            <span className={css.rowNo} aria-hidden>{index + 1}</span>
                            {skin !== undefined && <img src={skin.art} alt="" aria-hidden />}
                            {skin?.name ?? entry.skin}
                            <small>{agencyRole(entry.role)?.name ?? entry.role}</small>
                            <button type="button" onClick={() => { removeLineupEntry(lineup.id, index) }}>×</button>
                          </span>
                        )
                      })}
                    </div>
                    <div className={css.inlineForm}>
                      <select value={draftRole} onChange={(event) => { setDraftRole(event.target.value) }}>
                        {allRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                      </select>
                      <select value={draftSkin} onChange={(event) => { setDraftSkin(event.target.value) }}>
                        {skins.map(skin => <option key={skin.id} value={skin.id}>{skin.name} · {skin.theme}</option>)}
                      </select>
                      <button type="button" className={css.button} onClick={() => { addLineupEntry(lineup.id, { role: draftRole, skin: draftSkin }) }}>{t('office.lineupAddEntry')}</button>
                    </div>
                    <div className={css.actions}>
                      <button type="button" className={css.button} data-active={defaultLineup === lineup.id || undefined} onClick={() => { try { window.localStorage.setItem('dsh-super-agent.lastFaction', lineup.id) } catch { /* private mode */ } setDefaultLineup(lineup.id) }}>
                        {defaultLineup === lineup.id ? t('office.lineupDefaultActive') : t('office.lineupSetDefault')}
                      </button>
                      {lineup.builtin && <button type="button" className={css.button} onClick={() => { resetLineup(lineup.id) }}>{t('office.lineupReset')}</button>}
                      <button type="button" className={css.danger} onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        setConfirm({ kind: 'lineup', id: lineup.id, name: lineup.name, x: rect.left + rect.width / 2, y: rect.top })
                      }}>{t('office.lineupDelete')}</button>
                    </div>
                  </div>
                )}
              </section>
            )
          })}
          <div className={css.sectionHead} style={{ marginTop: 6 }}>
            <p className={css.hint}>{t('office.modeLineupHint')}</p>
          </div>
          {PRIMARY_MODES.map(mode => {
            const seats = modeLineup(mode)
            const spec = getModeSpec(mode)
            return (
              <section key={mode} className={css.row}>
                <div className={css.rowHead}>
                  <strong>{spec.emoji} {spec.name}</strong>
                  <span className={css.badge}>{seats.length}</span>
                </div>
                <div className={css.entries}>
                  {seats.map((seat, index) => (
                    <span key={seat.role} className={css.entry}>
                      <span className={css.rowNo} aria-hidden>{index + 1}</span>
                      {seat.name}
                    </span>
                  ))}
                </div>
              </section>
            )
          })}
          {hiddenLineups.length > 0 && (
            <section className={css.row}>
              <div className={css.rowHead}><strong>{t('office.lineupHidden')}</strong></div>
              {lineups.filter(lineup => hiddenLineups.includes(lineup.id)).map(lineup => (
                <div key={lineup.id} className={css.hiddenRow}>
                  <span>{lineup.name}</span>
                  <button type="button" className={css.button} onClick={() => { showLineup(lineup.id) }}>{t('office.lineupRestore')}</button>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {creatingLineup && (
        <div className={css.modalBackdrop} role="dialog" aria-modal>
          <div className={css.modal}>
            <strong>{t('office.lineupNewTitle')}</strong>
            <input value={newName} placeholder={t('office.lineupNewName')} onChange={(event) => { setNewName(event.target.value) }} />
            <textarea value={newTheme} rows={3} placeholder={t('office.lineupThemePlaceholder')} onChange={(event) => { setNewTheme(event.target.value) }} />
            <button type="button" className={css.button} disabled={polishing !== '' || newTheme.trim() === ''} onClick={() => { void polishCopy(newTheme, 'lineup', value => { setNewTheme(value) }) }}>{polishing === 'lineup' ? t('office.aiPolishing') : t('office.aiPolish')}</button>
            <div className={css.actions}>
              <button type="button" className={css.button} onClick={() => { setCreatingLineup(false); setNewName(''); setNewTheme('') }}>{t('office.cancel')}</button>
              <button type="button" className={css.button} disabled={newName.trim() === ''} onClick={() => { const lineup = createLineup(newName, newTheme); if (lineup !== undefined) setExpandedLineup(lineup.id); setCreatingLineup(false); setNewName(''); setNewTheme('') }}>{t('office.lineupCreate')}</button>
            </div>
          </div>
        </div>
      )}

      {creatingSkin && (
        <div className={css.modalBackdrop} role="dialog" aria-modal>
          <div className={css.modal}>
            <strong>{t('office.skinCreateTitle')}</strong>
            <input value={skinName} placeholder={t('office.skinName')} onChange={(event) => { setSkinName(event.target.value) }} />
            <label className={css.uploadRow}>
              <span>{t('office.skinUpload')}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file === undefined) return
                void readImageFile(file).then(setSkinArt)
              }} />
            </label>
            {skinArt !== '' && <img className={css.skinPreview} src={skinArt} alt="" aria-hidden />}
            <input value={skinBackground} placeholder="#2a2418" onChange={(event) => { setSkinBackground(event.target.value) }} />
            <input value={skinTheme} placeholder={t('office.skinTheme')} onChange={(event) => { setSkinTheme(event.target.value) }} />
            <button type="button" className={css.button} disabled={polishing !== '' || skinTheme.trim() === ''} onClick={() => { void polishCopy(skinTheme, 'skin', value => { setSkinTheme(value) }) }}>{polishing === 'skin' ? t('office.aiPolishing') : t('office.aiPolish')}</button>
            <div className={css.actions}>
              <button type="button" className={css.button} onClick={() => { setCreatingSkin(false); setSkinName(''); setSkinTheme('') }}>{t('office.cancel')}</button>
              <button type="button" className={css.button} disabled={skinName.trim() === '' || skinArt === ''} onClick={() => { addCustomSkin(skinName, skinArt, skinBackground, skinTheme); setCreatingSkin(false); setSkinName(''); setSkinTheme(''); setSkinArt('') }}>{t('office.skinCreateSubmit')}</button>
            </div>
          </div>
        </div>
      )}

      {roleCreating && (
        <div className={css.modalBackdrop} role="dialog" aria-modal>
          <div className={css.modal}>
            <strong>{t('office.roleNewTitle')}</strong>
            <p className={css.hint}>
              <a href="https://github.com/jnMetaCode/agency-agents-zh" target="_blank" rel="noreferrer">agency-agents-zh</a>
              {' · '}{AGENCY_ROLES.length} roles loaded
            </p>
            <input value={roleName} placeholder={t('office.customRoleName')} onChange={(event) => { setRoleName(event.target.value) }} />
            <input value={roleSkills} placeholder={t('office.roleSkills')} onChange={(event) => { setRoleSkills(event.target.value) }} />
            <select value={roleExecutor} onChange={(event) => { setRoleExecutor(event.target.value) }}>
              {['planner', 'implementer', 'verifier', 'reviewer', 'frontend', 'backend', 'architect', 'integrator', 'operator', 'documenter', 'researcher', 'security'].map(executor => <option key={executor} value={executor}>{executor}</option>)}
            </select>
            <select value={roleAgent} onChange={(event) => { setRoleAgent(event.target.value) }}>
              <option value="dsh">dsh</option>
              <option value="codex">codex</option>
            </select>
            <textarea value={rolePrompt} rows={5} placeholder={t('office.rolePromptFull')} onChange={(event) => { setRolePrompt(event.target.value) }} />
            <button type="button" className={css.button} disabled={polishing !== '' || rolePrompt.trim() === ''} onClick={() => { void polishCopy(rolePrompt, 'role', value => { setRolePrompt(value) }) }}>{polishing === 'role' ? t('office.aiPolishing') : t('office.aiPolish')}</button>
            <div className={css.actions}>
              <button type="button" className={css.button} onClick={() => { setRoleCreating(false); setRoleName(''); setRoleSkills(''); setRolePrompt('') }}>{t('office.cancel')}</button>
              <button type="button" className={css.button} disabled={roleName.trim() === ''} onClick={() => { addCustomAgencyRole({ name: roleName, category: 'engineering', skills: roleSkills.split(/[，,、]/).map(item => item.trim()).filter(Boolean), executor: roleExecutor, agent: roleAgent, prompt: rolePrompt }); setRoleCreating(false); setRoleName(''); setRoleSkills(''); setRolePrompt('') }}>{t('office.roleCreateSubmit')}</button>
            </div>
          </div>
        </div>
      )}

      {confirm !== undefined && createPortal(
        <div className={css.confirmPopoverGlobal} style={{ left: confirm.x, top: confirm.y }} role="dialog">
          <strong>{t('office.delete')}</strong>
          <div className={css.actions}>
            <button type="button" className={css.dangerSolid} onClick={deleteConfirmed}>{t('office.confirm')}</button>
            <button type="button" className={css.button} onClick={() => { setConfirm(undefined) }}>{t('office.cancel')}</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
