import { FileBase } from '@skmtc/core'

/** Constructor arguments for {@link KtFile}. */
export type KtFileArgs = {
  path: string
  /** The `package` this file declares (e.g. `app.models`). */
  packageName: string
}

/**
 * Kotlin rendering of a {@link FileBase}.
 *
 * Opens with a bare `package …` line (no trailing semicolon — unlike Java)
 * and, unlike Java, the file name is **not** required to match a contained
 * class (the relaxed-basename rule). Another point on the file-header
 * spectrum the abstract `FileBase` absorbs.
 */
export class KtFile extends FileBase {
  packageName: string

  constructor({ path, packageName }: KtFileArgs) {
    super({ path })
    this.packageName = packageName
  }

  override toString(): string {
    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    return `package ${this.packageName}\n\n${definitions}`
  }
}
