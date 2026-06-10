import { DefinitionBase } from '@skmtc/core'

/**
 * Rust rendering of a {@link DefinitionBase} — a `pub struct X { … }`,
 * `pub enum X { … }`, or `pub type X = …;` declaration.
 *
 * The forcing case for the opaque `Identifier.kind`. TypeScript's binary
 * `entityType` (`const`/`type`) and Go's uniform `type` keyword both let
 * the `Definition` pick its keyword without extra metadata. Rust cannot:
 * `struct`, `enum`, and `type` alias are all *type* entities, so the
 * keyword is recoverable only from a per-language discriminant the
 * engine never interprets — `this.identifier.kind`.
 *
 * Visibility comes from the neutral `exported` fact, rendered as Rust's
 * `pub` keyword (leaving the name untouched — unlike Go's casing).
 *
 * `kind` is an open string, so the switch has a real `default` (the
 * `type`-alias fallback) rather than a `never` exhaustiveness guard: the
 * language package, not core, owns the keyword vocabulary.
 */
export class RsDefinition extends DefinitionBase {
  override toString(): string {
    const vis = this.identifier.exported ? 'pub ' : ''
    const name = this.identifier.name

    switch (this.identifier.kind) {
      case 'struct':
        return `${vis}struct ${name} ${this.value}`
      case 'enum':
        return `${vis}enum ${name} ${this.value}`
      default:
        return `${vis}type ${name} = ${this.value};`
    }
  }
}
