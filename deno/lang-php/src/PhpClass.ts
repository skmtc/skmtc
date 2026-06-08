import type { Stringable } from '@skmtc/core'

/** A single promoted constructor property of a {@link PhpClass}. */
export type PhpPropertyArgs = {
  /** The property name (without the leading `$`). */
  name: string
  type: Stringable
  /**
   * Member visibility. PHP uses an explicit keyword on each member:
   * `public` when exposed, `private` otherwise. Defaults to `public`
   * (DTO properties are read by callers). Note this is *member*
   * visibility — PHP has no file-private top-level class, so the
   * neutral `exported` fact on the class identifier itself is ignored
   * by {@link import('./PhpDefinition.ts').PhpDefinition}.
   */
  exported?: boolean
  /** Whether the property type is nullable (`?type`). */
  nullable?: boolean
}

/**
 * Renders a PHP class **body** — a constructor with promoted properties —
 * the value an {@link import('./PhpDefinition.ts').PhpDefinition} wraps.
 *
 * This is the sharp test for the "Definition assembly" question: a PHP DTO
 * is not a `Name = value` declaration but a `class Name { … }` container
 * whose body is assembled from properties. The value renders the *body*;
 * the Definition subclass assembles the *shell* — the same split TS
 * (`export <kw> X = body`), Go (`type X struct body`), and Rust
 * (`pub struct X body`) already use. PHP confirms the split rather than
 * breaking it: the shell is language-specific, the value is always the
 * body.
 */
export class PhpClass {
  properties: PhpPropertyArgs[]

  constructor(properties: PhpPropertyArgs[]) {
    this.properties = properties
  }

  toString(): string {
    const params = this.properties.map(property => {
      const visibility = property.exported === false ? 'private' : 'public'
      const nullable = property.nullable ? '?' : ''
      return `        ${visibility} ${nullable}${property.type} $${property.name},`
    })

    return ['    public function __construct(', ...params, '    ) {}'].join('\n')
  }
}
