/**
 * Per-mode lineup presets: the roster size each development mode expects.
 *
 * The setting page shows these as read-only presets so a founder can see how
 * many seats a mode is tuned for before opening the wizard; the founding flow
 * still lets the user override seats per lineup.
 */
import type { TeamMode } from '../modes.ts'
import { agencyRole } from '../agency-roles-lite.ts'
import { SKINS } from './skins.ts'

export const MODE_ROSTERS: Readonly<Record<TeamMode, readonly string[]>> = {
  draft: [
    'product-manager',
    'engineering-senior-developer',
    'testing-evidence-collector',
  ],
  analysis: [
    'product-manager',
    'design-ux-researcher',
    'testing-evidence-collector',
    'engineering-technical-writer',
  ],
  plan: [
    'product-manager',
    'product-sprint-prioritizer',
    'engineering-software-architect',
    'engineering-code-reviewer',
  ],
  precision: [
    'product-manager',
    'engineering-senior-developer',
    'testing-evidence-collector',
    'engineering-code-reviewer',
    'design-ui-designer',
  ],
  stress: [
    'product-manager',
    'engineering-senior-developer',
    'testing-performance-benchmarker',
    'engineering-devops-automator',
    'testing-evidence-collector',
  ],
  compliance: [
    'product-manager',
    'security-appsec-engineer',
    'security-cloud-security-architect',
    'engineering-devops-automator',
    'testing-evidence-collector',
  ],
  legacy: [
    'engineering-codebase-onboarding-engineer',
    'engineering-senior-developer',
    'testing-evidence-collector',
    'engineering-code-reviewer',
  ],
  monetize: [
    'product-manager',
    'engineering-frontend-developer',
    'testing-evidence-collector',
    'engineering-code-reviewer',
  ],
}

export interface ModeLineupSeat {
  readonly role: string
  readonly name: string
  readonly skin: string
}

/** Seats for a mode: role id, display name, and the cycling skin id. */
export function modeLineup(mode: TeamMode): readonly ModeLineupSeat[] {
  return (MODE_ROSTERS[mode] ?? MODE_ROSTERS.draft).map((role, index) => ({
    role,
    name: agencyRole(role)?.name ?? role,
    skin: SKINS[index % SKINS.length]!.id,
  }))
}
