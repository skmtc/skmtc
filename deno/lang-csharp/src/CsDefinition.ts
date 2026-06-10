import { DefinitionBase } from '@skmtc/core'

/**
 * C# rendering of a {@link DefinitionBase} — a `public record Name( … );`
 * (or `class` / `struct` / `interface` / `enum`) declaration.
 *
 * Roadmap-tier language. Confirms the resolved Definition-assembly split
 * (shell on the subclass, body on the value) on a *positional* shell:
 * `${vis}${keyword} ${name}(\n${params}\n);`. The opaque
 * `Identifier.kind` picks the keyword (third consumer after Rust and PHP).
 *
 * Visibility: C# top-level types default to `internal`; the neutral
 * `exported` fact renders as `public` vs `internal` — a fifth distinct
 * `exported` behaviour (TS `export`, Go casing, Rust `pub`, PHP
 * member-only, C# `public`/`internal`).
 */
export class CsDefinition extends DefinitionBase {
  override toString(): string {
    const visibility = this.identifier.exported ? 'public' : 'internal'

    let keyword: string
    switch (this.identifier.kind) {
      case 'class':
        keyword = 'class'
        break
      case 'struct':
        keyword = 'struct'
        break
      case 'interface':
        keyword = 'interface'
        break
      case 'enum':
        keyword = 'enum'
        break
      default:
        keyword = 'record'
    }

    return `${visibility} ${keyword} ${this.identifier.name}(\n${this.value}\n);`
  }
}
