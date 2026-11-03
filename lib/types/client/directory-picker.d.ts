/**
 * Bridge to the host-native directory picker (ui-workspace service).
 *
 * The client root context owns the service; React surfaces do not receive it,
 * so apply() installs this tiny module-level adapter once per plugin lifetime.
 * A deployment without the service (plain web before the workspace UI loads)
 * resolves null and the user can still type an absolute path.
 */
type Picker = () => Promise<string | null>;
/** Install (or clear) the picker used by founding surfaces. */
export declare function setDirectoryPicker(next: Picker | undefined): void;
/** Open the host chooser; null means cancelled or unavailable. */
export declare function pickDirectoryPath(): Promise<string | null>;
export {};
