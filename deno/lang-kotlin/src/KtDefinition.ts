import { DefinitionBase } from '@skmtc/core'

/**
 * Kotlin rendering of a {@link DefinitionBase}.
 *
 * Roadmap-tier language. Two things it demonstrates:
 *
 * 1. **One Definition subclass spans structurally different shells via the
 *    opaque `kind`.** A `data class` is a `Name( … )` container; a
 *    top-level `val` is a `Name = value` assignment. The same
 *    `KtDefinition` dispatches between them on `kind` — the shell/body
 *    split holds across both forms within one language.
 *
 * 2. **Kotlin's distinctive constraint: top-level `val`/`fun` are legal.**
 *    Unlike C#/PHP/Java (which forbid a value at file scope), Kotlin's
 *    EntityKind vocabulary includes file-scope values — so `kind: 'val'`
 *    renders a real top-level declaration.
 *
 * Visibility: Kotlin defaults to `public`, so the neutral `exported` fact
 * renders as *nothing* when exported and `private ` when not — a sixth
 * distinct `exported` behaviour (keyword only to restrict).
 */
export class KtDefinition extends DefinitionBase {
  override toString(): string {
    const visibility = this.identifier.exported ? '' : 'private '

    switch (this.identifier.kind) {
      case 'val':
        return `${visibility}val ${this.identifier.name} = ${this.value}`
      case 'class':
        return `${visibility}class ${this.identifier.name}(\n${this.value}\n)`
      default:
        return `${visibility}data class ${this.identifier.name}(\n${this.value}\n)`
    }
  }
}
