import { DefinitionBase } from '@skmtc/core'

/**
 * Go rendering of a {@link DefinitionBase} — a `type <Name> <value>`
 * declaration (e.g. `type User struct { … }`).
 *
 * Proves core's abstract `DefinitionBase` subclasses cleanly for a
 * language whose declaration shape (`type X struct`) differs entirely
 * from TypeScript's `export const/type X = …`. Spike-level: record/struct
 * declarations only.
 */
export class GoDefinition extends DefinitionBase {
  override toString(): string {
    return `type ${this.identifier.name} ${this.value}`
  }
}
