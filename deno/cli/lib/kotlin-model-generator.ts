import type { Generator } from '@/lib/generator.ts'
import { camelCase } from '@skmtc/core/strings'
import { join } from '@std/path/join'

/**
 * Scaffolds a Kotlin model generator: the mechanical wiring (entry,
 * projection base, one projection making a single router call,
 * `enrichments.ts`), a `protocol.ts` declaring the value fields every
 * routed snippet carries (`KtValueFields` — annotations/defaultValue/
 * parameters, the fields consumers read instead of narrowing), and a
 * `toKtValue` router in the plain `SchemaToValueFn` shape (union in,
 * union out, intersected with the protocol — every case returns one
 * member, no casts) with **one module per router case** — the layout
 * doctrine made material, so an author fills in snippets instead of
 * inventing a file topology or re-deriving the type plumbing.
 *
 * The split between what is scaffolded and what is left is a single
 * rule: **a case is scaffolded when Kotlin has one honest answer, and
 * throws when the answer is a decision.**
 *
 * - Scaffolded, because the mapping is not a choice: `string` → String,
 *   `integer` → Int/Long, `number` → Double/Float, `boolean` → Boolean,
 *   `array` → List<T>, `ref` → the peer declaration's name, `object` →
 *   a data-class parameter list.
 * - Throws, because a guess would be wrong and silent: `union` (sealed
 *   hierarchy vs typealias vs collapsed supertype) and `unknown` (no
 *   honest Kotlin type — `Any` is not an answer, it is the absence of
 *   one).
 *
 * So `generate` is green from the first run and emits plain, valid,
 * compiling Kotlin, and every subsequent step is an increment against
 * a working loop. What the baseline deliberately does NOT decide is
 * the whole of the interesting surface: serialization annotations,
 * `format` policy, enums as `enum class`, nullability and default
 * strategy, access control, discriminated hierarchies. Each is left
 * commented at the case that owns it — that is generator authoring,
 * guided by the skmtc-generator and skmtc-lang-kotlin skills.
 *
 * The project must make `@skmtc/lang-kotlin` resolvable (pre-alpha: a
 * vendored workspace member; no JSR pin is written here).
 */
export class KotlinModelGenerator {
  generator: Generator

  constructor(generator: Generator) {
    this.generator = generator
  }

  async createModelFiles(generatorPath: string) {
    const srcPath = join(generatorPath, 'src')

    const mainModule = camelCase(this.generator.packageName, { upperFirst: true })

    await Deno.mkdir(srcPath, { recursive: true })

    await Deno.writeTextFile(join(generatorPath, 'mod.ts'), this.toRootMod())
    await Deno.writeTextFile(join(srcPath, 'mod.ts'), this.toModelMod(mainModule))
    await Deno.writeTextFile(join(srcPath, 'base.ts'), this.toModelProjectionBase())
    await Deno.writeTextFile(join(srcPath, 'enrichments.ts'), this.toEnrichments())
    await Deno.writeTextFile(join(srcPath, 'protocol.ts'), this.toProtocol())
    await Deno.writeTextFile(join(srcPath, 'Kt.ts'), this.toKt())
    await Deno.writeTextFile(join(srcPath, 'DataClassValue.ts'), this.toDataClassValue())
    await Deno.writeTextFile(join(srcPath, 'StringValue.ts'), this.toStringValue())
    await Deno.writeTextFile(join(srcPath, 'IntegerValue.ts'), this.toIntegerValue())
    await Deno.writeTextFile(join(srcPath, 'NumberValue.ts'), this.toNumberValue())
    await Deno.writeTextFile(join(srcPath, 'BooleanValue.ts'), this.toBooleanValue())
    await Deno.writeTextFile(join(srcPath, 'ArrayValue.ts'), this.toArrayValue())
    await Deno.writeTextFile(join(srcPath, 'RefValue.ts'), this.toRefValue(mainModule))
    await Deno.writeTextFile(
      join(srcPath, `${mainModule}Projection.ts`),
      this.toModelProjection(mainModule)
    )
  }

  toRootMod() {
    return `export { default } from './src/mod.ts'
`
  }

  toModelMod(mainModule: string) {
    return `import { toModelEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }
import { toEnrichmentSchema } from './enrichments.ts'
import { ${mainModule}Projection } from './${mainModule}Projection.ts'

export default toModelEntry({
  id: denoJson.name,
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel(${mainModule}Projection, refName)
  }
})
`
  }

  toModelProjectionBase() {
    return `import { toKtModelProjectionBase } from '@skmtc/lang-kotlin'
import type { KtIdentifierType } from '@skmtc/lang-kotlin'
import denoJson from '../deno.json' with { type: 'json' }
import { toEnrichmentSchema } from './enrichments.ts'

export const KtModelBase = toKtModelProjectionBase({
  id: denoJson.name,

  // The refName IS the Kotlin class name for DTO generators.
  toIdentifierName: ({ refName }) => refName,

  toIdentifierType: (refName, context): KtIdentifierType => {
    // \`.resolve()\` is identity on concrete schemas — call it
    // unconditionally; never \`schema.isRef() ? schema.resolve() : schema\`.
    const schema = context.resolveSchemaRefOnce(refName, denoJson.name).resolve()

    // Skeleton policy: objects are data classes, everything else a
    // typealias. Extend alongside the toKtValue router when a schema
    // shape needs a different declaration kind.
    return { type: schema.type === 'object' ? 'data-class' : 'typealias' }
  },

  // The export path doubles as the package: \`@/models/X.kt\` →
  // \`package models\`. The engine injects the generated-file suffix
  // (client.json#settings.generatedSuffix, default '.generated') —
  // keep it: Kotlin resolves by package, not filename, so a suffixed
  // file replaces a hand-written one as-is. Set it to "" only when
  // something outside Kotlin keys on the exact filename.
  toExportPath: ({ refName }) => \`@/models/\${refName}.kt\`,

  toEnrichmentSchema
})
`
  }

  toEnrichments() {
    return `import { emptyEnrichmentSchema } from '@skmtc/core'

// No user-configurable options yet. Declare Valibot fields here when the
// generator grows enrichment seams — and keep toEnrichmentSchema wired on
// BOTH the entry (src/mod.ts) and the projection base (src/base.ts).
export const toEnrichmentSchema = () => emptyEnrichmentSchema
`
  }

  toKt() {
    return `import type { SchemaType, TypeSystemArgs, TypeSystemValue } from '@skmtc/core'
import { ArrayValue } from './ArrayValue.ts'
import { BooleanValue } from './BooleanValue.ts'
import { DataClassValue } from './DataClassValue.ts'
import { IntegerValue } from './IntegerValue.ts'
import { NumberValue } from './NumberValue.ts'
import type { KtValueFields } from './protocol.ts'
import { RefValue } from './RefValue.ts'
import { StringValue } from './StringValue.ts'

/**
 * Maps a parsed schema node to a self-rendering Kotlin snippet — the
 * generator's central seam, and the ONLY place this generator is
 * allowed to branch on \`schema.type\` (gen-zod's \`toZodValue\`,
 * gen-typescript's \`Ts.ts\`). One case per type, each returning a
 * small snippet class that takes the TYPED schema variant, carries the
 * TypeSystem contract fields for its output type PLUS the generator's
 * protocol (\`KtValueFields\`, protocol.ts), extracts its facts in the
 * constructor, renders itself in \`toString()\`, and registers its own
 * imports. The router routes and constructs — it never builds strings,
 * and nothing downstream asks \`.type\` again: consumers read the
 * protocol fields off routed values instead of narrowing, which is why
 * the plain signature below (union in, union out) loses nothing — and
 * every case type-checks against it with no casts.
 *
 * The scaffolded cases render the one honest Kotlin answer and nothing
 * more; every policy decision on top of them is marked in the case
 * that owns the type. The two cases that THROW are the ones where a
 * default would be a silent wrong answer — implement them by replacing
 * the throw with a snippet, exactly like the others.
 */
export const toKtValue = (args: TypeSystemArgs<SchemaType>): TypeSystemValue & KtValueFields => {
  const { schema, destinationPath, required, context } = args

  switch (schema.type) {
    case 'string':
      // Baseline: plain String. The snippet captures \`format\` and
      // \`enums\` and deliberately leaves them undecided. When you
      // decide them, the decision lives HERE as a fork that CHOOSES a
      // snippet — one NEW module per rendered Kotlin type
      // (EnumClassValue, BigDecimalValue, OffsetDateTimeValue — see
      // the skmtc-lang-kotlin skill), never a branch inside
      // StringValue: a snippet renders exactly one type, and each new
      // snippet self-declares the serialization annotations its type
      // implies on its \`annotations\` protocol field.
      return new StringValue({
        context,
        stringSchema: schema,
        destinationPath,
        modifiers: { required }
      })
    case 'integer':
      return new IntegerValue({ context, integerSchema: schema, modifiers: { required } })
    case 'number':
      return new NumberValue({ context, numberSchema: schema, modifiers: { required } })
    case 'boolean':
      return new BooleanValue({ context, modifiers: { required } })
    case 'array':
      return new ArrayValue({
        context,
        arraySchema: schema,
        destinationPath,
        modifiers: { required }
      })
    case 'object':
      return new DataClassValue({
        context,
        objectSchema: schema,
        destinationPath,
        modifiers: { required }
      })
    case 'ref':
      return new RefValue({ context, ref: schema, modifiers: { required } })
    case 'union':
      // Which Kotlin shape a oneOf/anyOf becomes is a DECISION, not a
      // mapping: a discriminated union is idiomatically a sealed
      // interface whose members declare it as a supertype (the parent
      // also owning @JsonTypeInfo/@JsonSubTypes and the removal of the
      // tag property from each member), while an undiscriminated one
      // may be a typealias to a common supertype — or unrepresentable.
      // See the skmtc-lang-kotlin skill's 'oneOf → sealed interface'
      // recipe, then replace this throw with a one-line
      // \`return new UnionValue({ ... })\` — like every other case: the
      // UnionValue CONSTRUCTOR owns member routing, parent
      // annotations, membership assignment, and the tag removal (the
      // parent refName arrives as \`args.rootRef\`).
      throw new Error(\`toKtValue: 'union' is not mapped — decide the Kotlin shape for oneOf\`)
    case 'unknown':
      // An untyped schema has no honest Kotlin type. \`Any\`/\`Any?\` is
      // not an answer, it is the absence of one, and it compiles — so
      // the wrongness reaches production silently. Either fix the
      // schema so the node has a type, or decide a deliberate fallback
      // here and write down why.
      throw new Error(\`toKtValue: 'unknown' schema has no type — fix the schema or decide a fallback\`)
    default:
      throw new Error(\`toKtValue: schema type '\${schema.type}' is not mapped yet\`)
  }
}
`
  }

  toProtocol() {
    return `import type { Stringable } from '@skmtc/core'
import type { KtAnnotation, KtParameterArgs } from '@skmtc/lang-kotlin'

/**
 * A data-class parameter entry, tagged with the wire name it came from
 * so generate-time editors — e.g. a discriminated union parent
 * removing its tag property (the skmtc-lang-kotlin oneOf recipe) —
 * can find entries without re-deriving names.
 */
export type KtDataClassParameter = KtParameterArgs & { wireName: string }

/**
 * The value fields EVERY toKtValue router-case snippet carries
 * alongside its TypeSystem contract fields — this generator's own
 * protocol. Consumers read these fields off routed values and never
 * narrow \`.type\` (the single-dispatch rule):
 *
 * - \`annotations\` — serialization annotations the value self-declares
 *   for its type; empty when the type implies none (that mild burden
 *   is the point: consumers read fields, never narrow).
 * - \`defaultValue\` — an inherent zero value (e.g. a Map's
 *   \`emptyMap()\`), when the type has one.
 * - \`parameters\` — object values only: the entries array their
 *   KtParameterList renders, exposed for generate-time edits.
 */
export type KtValueFields = {
  annotations: KtAnnotation[]
  defaultValue?: Stringable
  parameters?: KtDataClassParameter[]
}
`
  }

  toStringValue() {
    return `import type { GenerateContextType, Modifiers, OasString } from '@skmtc/core'
import type { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtSnippet } from '@skmtc/lang-kotlin'

type StringValueArgs = {
  context: GenerateContextType
  stringSchema: OasString
  // Present on every value snippet: the file its imports register into.
  // A snippet has no file of its own — the parent passes this down.
  destinationPath: string
  modifiers: Modifiers
}

export class StringValue extends KtSnippet {
  // The TypeSystem contract fields for the 'string' output. \`format\`
  // and \`enums\` are declared EXACTLY as TypeSystemString declares
  // them: \`enums\` is a conditional over the schema class's Nullable
  // parameter, which defaults to \`boolean | undefined\` and therefore
  // never collapses to one arm. Narrowing it to \`string[]\` fails
  // \`deno check\` — which \`bundle\`/\`generate\` do NOT run (esbuild
  // does not typecheck). Filter at the point of use instead.
  type = 'string' as const
  format: string | undefined
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers
  // Protocol field (protocol.ts): annotations this value self-declares.
  // Empty — plain String implies none. A format-specific sibling
  // (BigDecimalValue, OffsetDateTimeValue) fills its own.
  annotations: KtAnnotation[] = []

  constructor({ context, stringSchema, modifiers }: StringValueArgs) {
    super({ context })

    this.format = stringSchema.format
    this.enums = stringSchema.enums
    this.modifiers = modifiers
  }

  override toString(): string {
    // Baseline: every string is a Kotlin String. \`format\` and \`enums\`
    // are captured above and deliberately undecided — the decisions
    // live in the router's string case as forks that CHOOSE a sibling
    // snippet (see Kt.ts), never as branches here: this snippet
    // renders exactly one Kotlin type.
    return 'String'
  }
}
`
  }

  toIntegerValue() {
    return `import type { GenerateContextType, Modifiers, OasInteger } from '@skmtc/core'
import type { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtSnippet } from '@skmtc/lang-kotlin'

type IntegerValueArgs = {
  context: GenerateContextType
  integerSchema: OasInteger
  modifiers: Modifiers
}

export class IntegerValue extends KtSnippet {
  type = 'integer' as const
  format: 'int32' | 'int64' | undefined
  modifiers: Modifiers
  // Protocol field (protocol.ts) — this type implies no annotations.
  annotations: KtAnnotation[] = []

  constructor({ context, integerSchema, modifiers }: IntegerValueArgs) {
    super({ context })

    this.format = integerSchema.format
    this.modifiers = modifiers
  }

  override toString(): string {
    // Width follows the schema's declared format; an integer with no
    // format is an Int. Bounds (minimum/maximum/multipleOf) and enums
    // are unhandled — Kotlin cannot express them in the type, so they
    // need either validation annotations or a deliberate decision to
    // drop them.
    return this.format === 'int64' ? 'Long' : 'Int'
  }
}
`
  }

  toNumberValue() {
    return `import type { GenerateContextType, Modifiers, OasNumber } from '@skmtc/core'
import type { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtSnippet } from '@skmtc/lang-kotlin'

type NumberValueArgs = {
  context: GenerateContextType
  numberSchema: OasNumber
  modifiers: Modifiers
}

export class NumberValue extends KtSnippet {
  type = 'number' as const
  format: 'float' | 'double' | undefined
  modifiers: Modifiers
  // Protocol field (protocol.ts) — this type implies no annotations.
  annotations: KtAnnotation[] = []

  constructor({ context, numberSchema, modifiers }: NumberValueArgs) {
    super({ context })

    this.format = numberSchema.format
    this.modifiers = modifiers
  }

  override toString(): string {
    // Double is the safe default — a number with no format is not a
    // Float. An exact-decimal value (money) is NOT a number in most
    // schemas: it arrives as a string with \`format: decimal\`, so that
    // policy belongs in StringValue, not here.
    return this.format === 'float' ? 'Float' : 'Double'
  }
}
`
  }

  toBooleanValue() {
    return `import type { GenerateContextType, Modifiers } from '@skmtc/core'
import type { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtSnippet } from '@skmtc/lang-kotlin'

type BooleanValueArgs = {
  context: GenerateContextType
  modifiers: Modifiers
}

export class BooleanValue extends KtSnippet {
  type = 'boolean' as const
  modifiers: Modifiers
  // Protocol field (protocol.ts) — this type implies no annotations.
  annotations: KtAnnotation[] = []

  constructor({ context, modifiers }: BooleanValueArgs) {
    super({ context })

    this.modifiers = modifiers
  }

  override toString(): string {
    return 'Boolean'
  }
}
`
  }

  toArrayValue() {
    return `import type { GenerateContextType, Modifiers, OasArray, TypeSystemValue } from '@skmtc/core'
import type { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtSnippet } from '@skmtc/lang-kotlin'
import { toKtValue } from './Kt.ts'

type ArrayValueArgs = {
  context: GenerateContextType
  arraySchema: OasArray
  destinationPath: string
  modifiers: Modifiers
}

export class ArrayValue extends KtSnippet {
  type = 'array' as const
  items: TypeSystemValue
  modifiers: Modifiers
  // Protocol field (protocol.ts) — this type implies no annotations.
  annotations: KtAnnotation[] = []

  constructor({ context, arraySchema, destinationPath, modifiers }: ArrayValueArgs) {
    super({ context })

    // A composite routes its children back through the SAME router —
    // that recursion is what makes nested types work, and it is why
    // this module and Kt.ts import each other. The cycle is expected
    // and safe: the reference happens inside a constructor, never at
    // module top level.
    //
    // \`required: true\` because an element INSIDE a list is not
    // optional — the array's own optionality is this snippet's
    // \`modifiers\`, not its items'.
    this.items = toKtValue({
      context,
      schema: arraySchema.items,
      destinationPath,
      required: true
    })
    this.modifiers = modifiers
  }

  override toString(): string {
    // List is the read-only default. uniqueItems could justify Set,
    // and minItems/maxItems have no Kotlin type-level expression —
    // both are decisions, and both are unmade here.
    return \`List<\${this.items}>\`
  }
}
`
  }

  toRefValue(mainModule: string) {
    return `import type { GenerateContextType, Modifiers, OasRef } from '@skmtc/core'
import type { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtSnippet } from '@skmtc/lang-kotlin'
import { ${mainModule}Projection } from './${mainModule}Projection.ts'

type RefValueArgs = {
  context: GenerateContextType
  ref: OasRef<'schema'>
  modifiers: Modifiers
}

export class RefValue extends KtSnippet {
  type = 'ref' as const
  name: string
  modifiers: Modifiers
  // Protocol field (protocol.ts) — this type implies no annotations.
  annotations: KtAnnotation[] = []

  constructor({ context, ref, modifiers }: RefValueArgs) {
    super({ context })

    // Declare the dependency and use its name — that is the whole job.
    // insertModel BUILDS the peer if it does not exist and returns the
    // memoized handle if it does, so there is nothing to check first,
    // no ordering to arrange, and no import to wire by hand: existence,
    // uniqueness, and placement are the engine's guarantees. (This
    // generator writes every declaration into one file, so peers are
    // same-package and need no import at all.)
    //
    // This module and the projection import each other; the projection
    // imports Kt.ts, which imports this. That cycle is expected and
    // safe for the same reason as ArrayValue's — constructor-body
    // references, never module top level.
    this.name = context.insertModel(${mainModule}Projection, ref.toRefName()).toName()
    this.modifiers = modifiers
  }

  override toString(): string {
    return this.name
  }
}
`
  }

  toDataClassValue() {
    return `import type {
  GenerateContextType,
  Modifiers,
  OasObject,
  TypeSystemObjectProperties,
  TypeSystemValue
} from '@skmtc/core'
import type { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtParameterList, KtSnippet, sanitizePropertyName } from '@skmtc/lang-kotlin'
import { toKtValue } from './Kt.ts'
import type { KtDataClassParameter } from './protocol.ts'

type DataClassValueArgs = {
  context: GenerateContextType
  objectSchema: OasObject
  destinationPath: string
  modifiers: Modifiers
}

export class DataClassValue extends KtSnippet {
  // The TypeSystem contract fields for the 'object' output — carrying
  // these is what keeps this snippet assignable to the router's
  // return type. Every snippet you add for another schema type
  // carries its own output type's fields the same way.
  type = 'object' as const
  recordProperties: null = null
  objectProperties: TypeSystemObjectProperties | null
  modifiers: Modifiers
  // Protocol fields (protocol.ts). A bare data class implies no
  // class-level annotations. \`parameters\` is the SAME array the
  // KtParameterList below renders — one array, two names — so a
  // generate-time edit through this field (a union parent removing
  // its discriminator property) is visible at render. Push into it or
  // splice it; never reassign it.
  annotations: KtAnnotation[] = []
  parameters: KtDataClassParameter[]

  parameterList: KtParameterList

  constructor({ context, objectSchema, destinationPath, modifiers }: DataClassValueArgs) {
    super({ context })

    this.modifiers = modifiers

    if (objectSchema.additionalProperties) {
      throw new Error('DataClassValue: additionalProperties is not mapped yet')
    }

    const required = objectSchema.required ?? []
    const properties: Record<string, TypeSystemValue> = {}

    // Properties route back through the toKtValue seam. EVERYTHING is
    // built here, in the constructor — the per-parameter decisions,
    // the imports the routed snippets register, and the
    // KtParameterList itself. toString() only reads: it constructs
    // nothing (the structural eval flags any \`new\` inside toString).
    this.parameters = Object.entries(objectSchema.properties ?? {}).map(
      ([wireName, property]) => {
        const value = toKtValue({
          context,
          schema: property,
          destinationPath,
          required: required.includes(wireName)
        })

        properties[wireName] = value

        return {
          wireName,
          name: sanitizePropertyName(wireName),
          type: value,
          nullable: !required.includes(wireName),
          defaultValue: required.includes(wireName) ? undefined : 'null'
        }
      }
    )
    this.parameterList = new KtParameterList(this.parameters)

    this.objectProperties = { properties }
  }

  override toString(): string {
    return \`\${this.parameterList}\`
  }
}
`
  }

  toModelProjection(mainModule: string) {
    return `import type { EmptyEnrichments, ModelProjectionArgs } from '@skmtc/core'
import type { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtModelBase } from './base.ts'
import { toKtValue } from './Kt.ts'

export class ${mainModule}Projection extends KtModelBase {
  // Typed by the router's return — NOT Stringable — so protocol reads
  // off \`.value\` type-check (e.g. a union parent reaching a member's
  // \`.value.parameters\`, the skmtc-lang-kotlin oneOf recipe).
  value: ReturnType<typeof toKtValue>
  // The KtAnnotated protocol slot: the Driver wraps THIS instance in
  // the Definition, so class-level annotations are read off the
  // projection itself. Wired by reference-sharing below — one array,
  // two names; whatever a router case put there is already here. Push
  // projection-level policy into it; NEVER reassign either name (a
  // later \`this.annotations = []\` silently splits the two names onto
  // different arrays).
  annotations: KtAnnotation[]

  // The enrichment generic must match the base: wiring
  // \`toEnrichmentSchema: () => emptyEnrichmentSchema\` makes the base
  // expect ModelProjectionArgs<EmptyEnrichments> — the bare
  // ModelProjectionArgs default (undefined) fails \`deno check\`, and
  // bundle/generate won't catch it (esbuild does not typecheck).
  constructor(args: ModelProjectionArgs<EmptyEnrichments>) {
    super(args)

    const { context, refName } = args
    const destinationPath = this.settings.exportPath
    const schema = context.resolveSchemaRefOnce(refName, KtModelBase.id).resolve()

    // Everything flows through the router — 'object' is a case like any
    // other, not a special case here.
    this.value = toKtValue({ context, schema, destinationPath, required: true })
    this.annotations = this.value.annotations
  }

  override toString(): string {
    return \`\${this.value}\`
  }
}
`
  }
}
