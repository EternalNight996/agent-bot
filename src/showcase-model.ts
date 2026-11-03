/**
 * Delivery-showcase view types shared by the host projection and the browser
 * panel. Kept free of Node imports so the client program can type-import it
 * without pulling the filesystem module into a DOM-only build.
 */

/** How the panel previews a file. */
export type ShowcaseKind = 'html' | 'image' | 'markdown' | 'text' | 'code' | 'pdf' | 'video' | 'audio' | 'other'

/** One displayable artifact. */
export interface ShowcaseFile {
  /** Workspace-relative POSIX path. */
  readonly path: string
  readonly kind: ShowcaseKind
  readonly size: number
  readonly mtimeMs: number
  /** A task declared it (deliverable / changed path / reviewed artifact) instead of only the scan finding it. */
  readonly declared: boolean
  /** The artifact the panel opens first. */
  readonly entry: boolean
}

/** One dynamic instruction stored with the delivery, e.g. run python or open HTML. */
export interface ShowcaseAction {
  readonly id: string
  readonly path: string
  readonly kind: 'preview' | 'process'
  /** Executable or interpreter; omitted for preview. */
  readonly command?: string
  readonly args?: readonly string[]
  /** Working directory relative to the workspace. */
  readonly cwd?: string
}

/** The whole delivery showcase for one team. */
export interface ShowcaseView {
  readonly teamId: string
  readonly teamName: string
  /** Workspace-relative product root, when the plan declared one. */
  readonly projectRoot?: string
  /** Path of the artifact the panel opens first. */
  readonly entry?: string
  readonly files: readonly ShowcaseFile[]
  /** Dynamic run/preview instructions generated for this delivery. */
  readonly actions: readonly ShowcaseAction[]
  /** The file walk hit its cap or depth limit. */
  readonly truncated: boolean
  /** When this view was assembled (the panel shows it as a freshness hint). */
  readonly generatedAt: number
}
