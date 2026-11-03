/**
 * Reveal rules for the team workspace tab.
 *
 * Two independent signals can make a team appear while the user is looking at
 * the conversation: an explicit creation the quick-start dialog just announced,
 * and the monitor discovering a team created elsewhere. They are deliberately
 * asymmetric. An explicit creation always reveals the tab — the user just
 * clicked "生成草案", and reviewing that draft is the only next step — even when
 * the right column is already expanded on another page (the discard button
 * closes the tab but keeps the column open, which used to swallow the next
 * draft). A discovered team only claims a collapsed column, so polling can
 * never replace a file or terminal the user is reading.
 */
/** Window event dispatched after the quick-start dialog staged a team. */
export declare const TEAM_CREATED_EVENT = "agent-teams:team-created";
export interface TeamRevealInput {
    /** Which signal asked for the reveal. */
    readonly source: 'created' | 'discovered';
    /** Session whose monitor observed the team. */
    readonly sessionId: string | undefined;
    /** Session the right column is currently on screen for. */
    readonly onScreenSessionId: string | undefined;
    /** Team that appeared; an empty id is nothing to reveal. */
    readonly teamId: string | undefined;
    /** Whether the right column already shows its panel. */
    readonly expanded: boolean;
}
/**
 * Whether the workspace tab must be opened for a team that just appeared.
 * @param input - the signal, both session identities, the team id, and the
 *   column's current expansion.
 * @returns `true` when the tab should be opened/focused.
 */
/** Minimal team shape needed to tell planning apart from executing work. */
export interface TeamStartInput {
    readonly phase?: string;
    readonly halted?: boolean;
    readonly tasks?: readonly {
        readonly status?: string;
    }[];
}
/**
 * Whether a team has actually started executing: it left the planning stage or
 * any task is claimed / in progress. A halted team is not "started" — its work
 * is stopped, so the view must not be pulled away from the user.
 * @param team - the activity team (or any snapshot with phase/tasks).
 * @returns `true` when real work has begun.
 */
export declare function teamHasStarted(team: TeamStartInput): boolean;
export declare function shouldRevealTeam(input: TeamRevealInput): boolean;
