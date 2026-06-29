import type { Stringable } from '@skmtc/core'
import { withDescription } from './withDescription.ts'
import { List } from './List.ts'
import type { TsHeritage } from './TsHeritage.ts'

/**
 * Member accessibility — the leading `public` / `private` / `protected`
 * keyword. Omit for the default (public, no keyword). The `#`-private form is
 * spelled in the member `name` itself (`'#encoder'`), so it needs no entry
 * here.
 */
export type TsAccessibility = 'public' | 'private' | 'protected'

/** Join the active member modifiers into a space-separated prefix (with a
 *  trailing space when non-empty). */
const toModifierPrefix = (modifiers: (string | false | undefined)[]): string => {
  const active = modifiers.filter((modifier): modifier is string => Boolean(modifier))
  return active.length ? `${active.join(' ')} ` : ''
}

/** Render a method/constructor body block — `{<body>}`, or `{}` when empty. No
 *  newlines or indentation; the consumer's formatter expands and indents the
 *  body. */
const toBodyBlock = (body: Stringable | undefined): string => ` {${body ?? ''}}`

/**
 * Constructor arguments for {@link TsProperty}.
 */
export type TsClassPropertyArgs = {
  name: string
  /** The property's type annotation (`: <type>`). Any `Stringable`. */
  type?: Stringable
  /** The initializer (`= <value>`). Any `Stringable`. */
  value?: Stringable
  /** Renders the optional marker (`name?`). */
  optional?: boolean
  readonly?: boolean
  static?: boolean
  accessibility?: TsAccessibility
  /** JSDoc rendered above the property. */
  description?: string
}

/**
 * One class property/field — renders
 * `[jsdoc][access ][static ][readonly ]name[?][: type][ = value];`. A pure
 * {@link Stringable}; {@link TsClass} owns its placement.
 */
export class TsProperty {
  name: string
  type: Stringable | undefined
  value: Stringable | undefined
  isOptional: boolean
  isReadonly: boolean
  isStatic: boolean
  accessibility: TsAccessibility | undefined
  description: string | undefined

  constructor(args: TsClassPropertyArgs) {
    this.name = args.name
    this.type = args.type
    this.value = args.value
    this.isOptional = args.optional ?? false
    this.isReadonly = args.readonly ?? false
    this.isStatic = args.static ?? false
    this.accessibility = args.accessibility
    this.description = args.description
  }

  toString(): string {
    const prefix = toModifierPrefix([
      this.accessibility,
      this.isStatic && 'static',
      this.isReadonly && 'readonly'
    ])
    const optional = this.isOptional ? '?' : ''
    const annotation = this.type === undefined ? '' : `: ${this.type}`
    const initializer = this.value === undefined ? '' : ` = ${this.value}`

    return withDescription(`${prefix}${this.name}${optional}${annotation}${initializer};`, {
      description: this.description
    })
  }
}

/**
 * Constructor arguments for {@link TsMethod}.
 */
export type TsMethodArgs = {
  name: string
  /** Parameters, each already rendered (`'model: string'`, `'options?: RequestOptions'`). */
  parameters?: Stringable[]
  /** The return-type annotation (`: <returnType>`). */
  returnType?: Stringable
  /** The method body — statements without the braces. */
  body?: Stringable
  /** JSDoc rendered above the method. */
  description?: string
  async?: boolean
  static?: boolean
  accessibility?: TsAccessibility
}

/**
 * One class method — renders
 * `[jsdoc][access ][static ][async ]name(params)[: returnType] { body }`.
 */
export class TsMethod {
  name: string
  parameters: Stringable[]
  returnType: Stringable | undefined
  body: Stringable | undefined
  description: string | undefined
  isAsync: boolean
  isStatic: boolean
  accessibility: TsAccessibility | undefined

  constructor(args: TsMethodArgs) {
    this.name = args.name
    this.parameters = args.parameters ?? []
    this.returnType = args.returnType
    this.body = args.body
    this.description = args.description
    this.isAsync = args.async ?? false
    this.isStatic = args.static ?? false
    this.accessibility = args.accessibility
  }

  toString(): string {
    const prefix = toModifierPrefix([
      this.accessibility,
      this.isStatic && 'static',
      this.isAsync && 'async'
    ])
    const annotation = this.returnType === undefined ? '' : `: ${this.returnType}`

    return withDescription(
      `${prefix}${this.name}${List.toParams(this.parameters)}${annotation}${toBodyBlock(this.body)}`,
      { description: this.description }
    )
  }
}

/**
 * Constructor arguments for {@link TsConstructor}.
 */
export type TsConstructorArgs = {
  parameters?: Stringable[]
  body?: Stringable
  description?: string
  accessibility?: TsAccessibility
}

/**
 * The single class constructor — renders
 * `[jsdoc][access ]constructor(params) { body }`. A method without a name or
 * return type.
 */
export class TsConstructor {
  parameters: Stringable[]
  body: Stringable | undefined
  description: string | undefined
  accessibility: TsAccessibility | undefined

  constructor(args: TsConstructorArgs = {}) {
    this.parameters = args.parameters ?? []
    this.body = args.body
    this.description = args.description
    this.accessibility = args.accessibility
  }

  toString(): string {
    const prefix = toModifierPrefix([this.accessibility])

    return withDescription(`${prefix}constructor${List.toParams(this.parameters)}${toBodyBlock(this.body)}`, {
      description: this.description
    })
  }
}

/**
 * Constructor arguments for {@link TsClass}.
 */
export type TsClassArgs = {
  /** The heritage — a {@link TsHeritage} entity composing the `extends` /
   *  `implements` clauses (which each own their rendering and imports). */
  heritage?: TsHeritage
  /** The single constructor. Named `classConstructor` (not `constructor`) so it
   *  can't collide with `Object.prototype.constructor` when read off the args. */
  classConstructor?: TsConstructor
}

/**
 * TypeScript's structured class *value* — what a `class`-kind
 * {@link import('./TsDefinition.ts').TsDefinition} wraps (`export class Name
 * <value>`). It is to a class declaration what {@link TsFile} is to a file: a
 * container of self-rendering members ({@link TsProperty} / {@link TsConstructor}
 * / {@link TsMethod}) that it dedups (by member name, first-write-wins — the
 * {@link TsFile} policy) and arranges (properties → constructor → methods,
 * newline-joined, no indentation).
 *
 * A pure {@link Stringable}: it owns the class *structure* only. **Imports are
 * not its concern** — {@link TsFile} is the import authority (storage, dedup,
 * merge). The heritage is a {@link TsHeritage} entity composing the `extends` /
 * `implements` clauses, which each own their rendering and register the import
 * of the symbol they name; the members' imports are registered by the generator
 * through the normal `register` flow. So `TsClass` carries no `context` and
 * never registers; `toString()` is a pure render of the accumulated members.
 */
export class TsClass {
  heritage: TsHeritage | undefined

  /** Properties keyed by name; first write for a name wins. */
  properties: Map<string, TsProperty> = new Map()
  /** The single constructor, supplied at construction. */
  classConstructor: TsConstructor | undefined
  /** Methods keyed by name; first write for a name wins. */
  methods: Map<string, TsMethod> = new Map()

  constructor(args: TsClassArgs = {}) {
    this.heritage = args.heritage
    this.classConstructor = args.classConstructor
  }

  /** Add a property; a no-op if one of the same name is already present. */
  addProperty(property: TsProperty): void {
    if (!this.properties.has(property.name)) {
      this.properties.set(property.name, property)
    }
  }

  /** Add a method; a no-op if one of the same name is already present. */
  addMethod(method: TsMethod): void {
    if (!this.methods.has(method.name)) {
      this.methods.set(method.name, method)
    }
  }

  toString(): string {
    // Properties render as one flush block (no blank line between sub-resource
    // fields); the constructor and each method are blank-line-separated. That
    // separation is NOT formatting the consumer's formatter can restore —
    // Prettier preserves but never *inserts* blank lines between class members
    // — so it's emitted here (verified end-to-end: dropping it left methods
    // flush, the only diff from byte-exact openai-node; see note 42). A method
    // body's *internal* whitespace stays the formatter's job (`{return x;}`
    // renders inline). An empty class renders `{\n\n}`.
    const propertyBlock = this.properties.size
      ? List.toLines([...this.properties.values()])
      : undefined

    const body = new List([propertyBlock, this.classConstructor, ...this.methods.values()], {
      separator: '\n\n'
    })

    // `this.heritage` renders the `extends … implements …` clause (with its
    // trailing space); a missing one contributes nothing.
    return `${this.heritage ?? ''}{\n${body}\n}`
  }
}
