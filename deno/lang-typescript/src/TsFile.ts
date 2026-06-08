import { FileBase } from '@skmtc/core'

/**
 * TypeScript rendering of a {@link FileBase}.
 *
 * Spike-level proof that a `@skmtc/lang-*` package can subclass core's
 * abstract `FileBase` and render itself from the inherited coordination
 * surface (`definitions`). Import grouping, re-exports, and module-path
 * formatting land as the anchor matures (notes/lang Track 1).
 */
export class TsFile extends FileBase {
  override toString(): string {
    return Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')
  }
}
