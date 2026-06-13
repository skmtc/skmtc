import { capitalize, decapitalize, DefinitionBase } from '@skmtc/core'

/**
 * Go rendering of a {@link DefinitionBase} — a `type <Name> <value>`
 * declaration (e.g. `type User struct { … }`).
 *
 * Proves core's abstract `DefinitionBase` subclasses cleanly for a
 * language whose declaration shape (`type X struct`) differs entirely
 * from TypeScript's `export const/type X = …`. Spike-level: record/struct
 * declarations only.
 *
 * The declaration name's casing follows the neutral `GoIdentifier.exported`
 * fact (inherited from `IdentifierBase`) — capitalized when exported,
 * lowercase otherwise — so a generator
 * declares *intent* (`exported`) and Go renders the visibility, rather
 * than the generator hand-casing the name and risking a silently-private
 * type.
 */
export class GoDefinition extends DefinitionBase {
  override toString(): string {
    const name = this.identifier.exported
      ? capitalize(this.identifier.name)
      : decapitalize(this.identifier.name)

    return `type ${name} ${this.value}`
  }
}
