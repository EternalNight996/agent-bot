/**
 * Delivery showcase: which files a finished team actually produced, and how
 * the browser can display them in place of "open this file and run it".
 *
 * The product rule this module serves: a delivery is shown to the user inside
 * 法脉·藏经阁, never handed over as a command the user has to run. The module is
 * therefore split into pure discovery (a deterministic list of displayable
 * artifacts) and one containment-checked resolver; the plugin's Web routes
 * stream the bytes. Nothing here renders, executes, or trusts a request path.
 *
 * Safety rules:
 *  · every read is a workspace-relative path resolved with realpath and
 *    rejected when it leaves the workspace, so a symlink cannot become a read
 *    of host files;
 *  · hidden files ('.env', '.git', …) and package/state directories never enter
 *    the list, so a showcase cannot advertise secrets or installed packages;
 *  · serving is limited to files under the team's product root or to artifacts
 *    a task actually declared, and one response is capped at
 *    {@link MAX_SHOWCASE_FILE_BYTES}.
 *
 * @module dsh-super-agent/showcase
 */
import type { ShowcaseKind, ShowcaseView } from './showcase-model.ts';
import type { TeamState } from './types.ts';
export type { ShowcaseFile, ShowcaseKind, ShowcaseView } from './showcase-model.ts';
/** Largest single artifact the showcase will serve. */
export declare const MAX_SHOWCASE_FILE_BYTES: number;
/** A resolved artifact ready to stream. */
export interface ShowcaseAsset {
    readonly absolutePath: string;
    readonly mediaType: string;
    readonly size: number;
    /** Serve as HTML and rewrite root-relative references under the mount. */
    readonly html: boolean;
}
/** Resolution failure carrying the HTTP status the route should answer with. */
export interface ShowcaseAssetFailure {
    readonly ok: false;
    readonly status: 400 | 403 | 404 | 413;
    readonly error: string;
}
/** Result of resolving a requested artifact path. */
export type ShowcaseAssetResult = {
    readonly ok: true;
    readonly asset: ShowcaseAsset;
} | ShowcaseAssetFailure;
/** Classify a path for preview purposes. */
export declare function showcaseKindOf(path: string): ShowcaseKind;
/**
 * Normalize one workspace-relative POSIX path. Absolute paths, drive letters,
 * empty segments and '..' are rejected (never clamped, so a caller cannot turn
 * a rejected path into a broader one).
 */
export declare function normalizeShowcasePath(input: string): string | undefined;
export declare function buildShowcase(workspace: string, team: Pick<TeamState, 'id' | 'name' | 'planProjectRoot' | 'tasks'>): ShowcaseView;
/** Media type for one artifact path; unknown extensions stream as octet-stream. */
export declare function showcaseMediaType(path: string): string;
/**
 * Resolve one requested artifact to a readable absolute path.
 *
 * A request is only honored when it names a workspace file the showcase could
 * actually show: inside the team's product root, or one of the artifacts a
 * task declared. Sibling assets of an HTML page (scripts, styles, images) are
 * covered by the product-root rule, so a page renders with its own bundle.
 */
export declare function resolveShowcaseAsset(workspace: string, team: Pick<TeamState, 'id' | 'name' | 'planProjectRoot' | 'tasks'>, requested: string): ShowcaseAssetResult;
/** One decoded showcase file request: which session/team/preview path. */
export interface ShowcasePathTarget {
    readonly sessionId: string;
    readonly teamId: string;
    /** Workspace-relative POSIX path of the requested artifact. */
    readonly path: string;
}
/**
 * Parse a mounted preview URL into its session, team and artifact path.
 *
 * The mount keeps session and team in the path (not only the query) so an
 * artifact's own relative references stay under the same authenticated prefix.
 * Malformed percent-encoding and short paths are rejected rather than
 * partially decoded.
 */
export declare function parseShowcaseFilePath(pathname: string, prefix: string): ShowcasePathTarget | undefined;
/**
 * Prepare a delivered HTML page for in-place preview.
 *
 * Two rewrites keep a page working when it is served from the plugin's mount
 * instead of its own directory: a <base> tag pins relative references, and
 * root-relative references ('/assets/app.js', the Vite default) are re-anchored
 * under the mount's directory for that page. Everything else is left intact —
 * the preview must show the artifact as built, not a sanitized re-render.
 */
export declare function rewriteShowcaseHtml(source: string, mountBase: string): string;
