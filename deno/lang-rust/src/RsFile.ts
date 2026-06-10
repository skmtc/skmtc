import { FileBase } from '@skmtc/core'

/** Constructor arguments for {@link RsFile}. */
export type RsFileArgs = {
  path: string
}

/**
 * Rust rendering of a {@link FileBase}.
 *
 * A third point on the file-header spectrum: TypeScript opens with bare
 * top-level declarations, Go *requires* a `package <name>` directive, and
 * Rust requires **no** header at all — modules come from the directory
 * tree, not an in-file statement. Proving all three subclass the one
 * abstract `FileBase` is the cross-language signal that the engine's
 * file-coordination surface (`path` + `definitions`) carries no syntactic
 * assumption about how a file opens.
 *
 * `use` imports are held as raw paths for the spike; structured import
 * specifiers + `pub use` re-exports land as the seam matures.
 */
export class RsFile extends FileBase {
  uses: string[] = []

  constructor({ path }: RsFileArgs) {
    super({ path })
  }

  addUse(path: string): void {
    this.uses.push(path)
  }

  override toString(): string {
    const uses = this.uses.map(use => `use ${use};`).join('\n')

    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    return [uses, definitions].filter(section => section.length > 0).join('\n\n')
  }
}
