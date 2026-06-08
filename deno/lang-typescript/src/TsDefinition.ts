import { DefinitionBase } from '@skmtc/core'

/**
 * TypeScript rendering of a {@link DefinitionBase}.
 *
 * Spike-level proof that a `@skmtc/lang-*` package can subclass core's
 * abstract `DefinitionBase` (resolved via Deno workspace resolution) and
 * own the rendering. Full fidelity — JSDoc, `noExport`/visibility, type
 * annotations, the trailing `;` — lands as the anchor matures toward the
 * byte-identical gate (notes/lang Track 1).
 */
export class TsDefinition extends DefinitionBase {
  override toString(): string {
    return `export ${this.identifier.entityType} ${this.identifier.name} = ${this.value}`
  }
}
