/**
 * Bridge to the host-native directory picker (ui-workspace service).
 *
 * The client root context owns the service; React surfaces do not receive it,
 * so apply() installs this tiny module-level adapter once per plugin lifetime.
 * A deployment without the service (plain web before the workspace UI loads)
 * resolves null and the user can still type an absolute path.
 */
type Picker = () => Promise<string | null>

let picker: Picker | undefined

/** Install (or clear) the picker used by founding surfaces. */
export function setDirectoryPicker(next: Picker | undefined): void {
  picker = next
}

/** Open the host chooser; null means cancelled or unavailable. */
export async function pickDirectoryPath(): Promise<string | null> {
  if (picker === undefined) return null
  return await picker()
}
