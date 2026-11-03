/**
 * Per-mode lineup presets: the roster size each development mode expects.
 *
 * The setting page shows these as read-only presets so a founder can see how
 * many seats a mode is tuned for before opening the wizard; the founding flow
 * still lets the user override seats per lineup.
 */
import type { TeamMode } from '../modes.ts';
export declare const MODE_ROSTERS: Readonly<Record<TeamMode, readonly string[]>>;
export interface ModeLineupSeat {
    readonly role: string;
    readonly name: string;
    readonly skin: string;
}
/** Lineup id prefix for a mode's preset roster (shared by the settings page and the founding lobby). */
export declare const MODE_LINEUP_PREFIX = "mode-";
/** Stable lineup id for one mode's preset roster. */
export declare function modeLineupId(mode: TeamMode): string;
/** Seats for a mode: role id, display name, and the cycling skin id. */
export declare function modeLineup(mode: TeamMode): readonly ModeLineupSeat[];
