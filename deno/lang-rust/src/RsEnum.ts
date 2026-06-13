import type { Stringable } from '@skmtc/core'

/** A single variant of a {@link RsEnum}. */
export type RsVariantArgs = {
  /** The variant name (PascalCase by convention). */
  name: string
  /**
   * Optional tuple-variant payload type, e.g. `Cat` in `Cat(Cat)`. When
   * absent the variant is a bare unit variant (`Pending,`).
   */
  payload?: Stringable
}

/**
 * Renders a Rust native tagged `enum { … }` body — the value an {@link
 * import('./RsDefinition.ts').RsDefinition} wraps for a `oneOf` schema.
 *
 * This is Rust's **distinctive-constraint test**: where TypeScript models a
 * `oneOf` as a union (`A | B`) and Go has no native sum type at all, Rust
 * has a first-class tagged enum. Proving it renders through the same
 * `FileBase`/`DefinitionBase` seam confirms the abstraction reaches a
 * language whose declaration vocabulary (`struct` vs `enum` vs `type`) is
 * richer than the binary `EntityType` can express — which is what forces
 * the per-language `RsIdentifier.kind`.
 */
export class RsEnum {
  variants: RsVariantArgs[]

  constructor(variants: RsVariantArgs[]) {
    this.variants = variants
  }

  toString(): string {
    const lines = this.variants.map(variant =>
      variant.payload ? `\t${variant.name}(${variant.payload}),` : `\t${variant.name},`
    )

    return `{\n${lines.join('\n')}\n}`
  }
}
