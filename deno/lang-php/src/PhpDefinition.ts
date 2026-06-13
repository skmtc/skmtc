import { DefinitionBase } from '@skmtc/core'
import invariant from 'npm:tiny-invariant@1.3.3'
import { isPhpIdentifier } from './PhpIdentifier.ts'

/**
 * PHP rendering of a {@link DefinitionBase} — a `class X { … }` (or
 * `interface` / `enum` / `trait`) container.
 *
 * Two findings this proves:
 *
 * 1. **Definition-assembly resolves to "shell on the subclass, body on
 *    the value".** The PHP declaration has no `= value` form — it is a
 *    `class Name\n{\n…\n}` container. `PhpDefinition` assembles that
 *    shell; the {@link import('./PhpClass.ts').PhpClass} value renders
 *    the body. This is the same split Go (`type X struct …`) and Rust
 *    (`pub struct X …`) already use — the shell was never universally
 *    `<kw> X = value`, so PHP fits the pattern rather than breaking it.
 *
 * 2. **The per-language `PhpIdentifier.kind` picks the keyword** (`class` /
 *    `interface` / `enum` / `trait`), exactly as Rust's does — a second
 *    independent consumer of the discriminant.
 *
 * Note: the neutral `exported` fact is **ignored** at the class level —
 * PHP has no file-private top-level class. Visibility lives on members
 * (`public`/`private` in {@link import('./PhpClass.ts').PhpClass}). This
 * is the "others may ignore it" case in the `IdentifierBase.exported`
 * contract, a fourth distinct behaviour after TS `export`, Go casing,
 * and Rust `pub`.
 */
export class PhpDefinition extends DefinitionBase {
  override toString(): string {
    const identifier = this.identifier
    invariant(
      isPhpIdentifier(identifier),
      `PhpDefinition needs a PhpIdentifier to render '${identifier.name}'`
    )

    let keyword: string
    switch (identifier.kind) {
      case 'interface':
        keyword = 'interface'
        break
      case 'enum':
        keyword = 'enum'
        break
      case 'trait':
        keyword = 'trait'
        break
      default:
        keyword = 'class'
    }

    return `${keyword} ${identifier.name}\n{\n${this.value}\n}`
  }
}
