import type { Stringable } from '@skmtc/core'
import type { CsAttribute } from './CsAttribute.ts'
import { escapeXml } from './withDescription.ts'

/** A single parameter of a C# method signature. */
export type CsMethodParameterArgs = {
  /**
   * The FINAL parameter name — already camelCased and sanitized by the
   * generator (`sanitizePropertyName(camelCase(wireName))`); may be
   * `@`-prefixed.
   */
  name: string
  type: Stringable
  /** Optional default (` = …`) — e.g. `'null'` on optional seam parameters. */
  defaultValue?: Stringable
  /** Inline attributes rendered before the type (e.g. `[FromQuery(Name = "…")]`). */
  attributes?: CsAttribute[]
}

/**
 * Renders a C# method parameter:
 * `[FromQuery(Name = "limit")] int? limit`, `int? limit = null`.
 *
 * Grammar only — WHICH attributes to attach (`[FromRoute]`,
 * `[FromQuery]`, `[FromBody]`) is generator policy riding
 * {@link import('./CsAttribute.ts').CsAttribute}. Distinct from
 * {@link import('./CsPropertyList.ts').CsPropertyArgs} (record property
 * members) — the two are different productions.
 */
export class CsMethodParameter {
  name: string
  type: Stringable
  defaultValue: Stringable | undefined
  attributes: CsAttribute[] | undefined

  constructor({ name, type, defaultValue, attributes }: CsMethodParameterArgs) {
    this.name = name
    this.type = type
    this.defaultValue = defaultValue
    this.attributes = attributes
  }

  toString(): string {
    const attributes = this.attributes?.length
      ? this.attributes.map(attribute => `${attribute} `).join('')
      : ''
    const defaultValue = this.defaultValue !== undefined ? ` = ${this.defaultValue}` : ''

    return `${attributes}${this.type} ${this.name}${defaultValue}`
  }
}

/**
 * Constructor arguments for {@link CsMethodSignature}.
 */
export type CsMethodSignatureArgs = {
  /** The FINAL method name — already PascalCased/sanitized by the generator. */
  name: string
  parameters: CsMethodParameterArgs[]
  /** Omitted → `void` (C# has no implicit return type). */
  returnType?: Stringable
  /** Attributes rendered one per line above the signature (e.g. `[HttpGet("…")]`). */
  attributes?: CsAttribute[]
  /** XML-doc summary rendered above the attributes, indented with the signature; XML-escaped here (escaping is grammar). */
  description?: string
  /**
   * Modifier text rendered before the return type (`'public async'`) —
   * policy text the lang renders verbatim. Absent → none (the abstract
   * interface-member form).
   */
  modifiers?: string
  /**
   * Expression body (` => …;`), e.g. a delegation
   * (`await service.GetUsers(limit)`). Absent → the abstract `;` form.
   * Block bodies are deliberately unsupported — hand-shaped content
   * belongs in a custom snippet value.
   */
  expressionBody?: Stringable
}

/**
 * Renders a C# method signature — the building block of an `interface`
 * or `class` body:
 *
 * ```csharp
 *     [HttpGet("/users/{id}")]
 *     public async Task<User> GetUser([FromRoute(Name = "id")] string id) => await service.GetUser(id);
 * ```
 *
 * Indented one level (it lives inside a declaration body); parameters
 * on one line (formatting is the consumer's formatter's job). Abstract
 * by default (`;`); an `expressionBody` renders the delegation form
 * (` => …;`). Unlike Kotlin there is no implicit return type — absent
 * `returnType` renders `void`. Grammar only — the routing/binding
 * attributes are generator policy.
 */
export class CsMethodSignature {
  name: string
  parameters: CsMethodParameter[]
  returnType: Stringable | undefined
  attributes: CsAttribute[] | undefined
  description: string | undefined
  modifiers: string | undefined
  expressionBody: Stringable | undefined

  constructor({
    name,
    parameters,
    returnType,
    attributes,
    description,
    modifiers,
    expressionBody
  }: CsMethodSignatureArgs) {
    this.name = name
    this.parameters = parameters.map(parameter => new CsMethodParameter(parameter))
    this.returnType = returnType
    this.attributes = attributes
    this.description = description
    this.modifiers = modifiers
    this.expressionBody = expressionBody
  }

  toString(): string {
    const documentation = this.description
      ? `    /// <summary>\n${escapeXml(this.description)
          .split('\n')
          .map(line => `    /// ${line}`.trimEnd())
          .join('\n')}\n    /// </summary>\n`
      : ''
    const attributes = this.attributes?.length
      ? this.attributes.map(attribute => `    ${attribute}\n`).join('')
      : ''
    const modifiers = this.modifiers ? `${this.modifiers} ` : ''
    const parameters = this.parameters.join(', ')
    const returnType = this.returnType ?? 'void'
    const body = this.expressionBody !== undefined ? ` => ${this.expressionBody};` : ';'

    return `${documentation}${attributes}    ${modifiers}${returnType} ${this.name}(${parameters})${body}`
  }
}
