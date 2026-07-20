import type { Generator } from '@/lib/generator.ts'
import { camelCase } from '@skmtc/core/strings'
import { join } from '@std/path/join'

/**
 * Scaffolds a Kotlin model generator SKELETON: the mechanical wiring only
 * (entry, projection base, one projection making a single router call,
 * `enrichments.ts`), plus a `toKtValue` router typed `SchemaToValueFn`
 * with exactly ONE case implemented — 'object' → `DataClassValue`, the
 * worked example of the pattern (typed variant in, TypeSystem contract
 * fields carried, self-rendering, self-registering imports) — and a
 * default that throws. The skeleton bundles and type-checks; `generate`
 * fails loudly until the author implements the remaining schema→snippet
 * mapping, one self-rendering snippet per variant (the gen-zod /
 * gen-typescript shape). Deliberately carries NO answers beyond that
 * example: no scalar mapping, no enum/union handling, no format policy,
 * no serialization annotations — that is generator authoring, guided by
 * the skmtc-generator and skmtc-lang-kotlin skills.
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
    await Deno.writeTextFile(join(srcPath, 'Kt.ts'), this.toKt())
    await Deno.writeTextFile(join(srcPath, 'DataClassValue.ts'), this.toDataClassValue())
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
    return `import type { SchemaToValueFn } from '@skmtc/core'
import { DataClassValue } from './DataClassValue.ts'

/**
 * Maps a parsed schema node to a self-rendering Kotlin snippet — the
 * generator's central seam. Only the 'object' case is implemented, as
 * the worked example of the shape (gen-zod's \`toZodValue\`,
 * gen-typescript's \`Ts.ts\`): one case per \`schema.type\`, each
 * returning a small snippet class that takes the TYPED schema variant,
 * carries the TypeSystem contract fields for its output type, extracts
 * its facts in the constructor, renders itself in \`toString()\`, and
 * registers its own imports. The router routes and constructs — it
 * never builds strings.
 */
export const toKtValue: SchemaToValueFn = ({
  schema,
  destinationPath,
  required,
  context,
  rootRef
}) => {
  switch (schema.type) {
    case 'object':
      return new DataClassValue({
        context,
        objectSchema: schema,
        destinationPath,
        modifiers: { required }
      })
    // case 'string':
    //   return new KtString({ context, stringSchema: schema, destinationPath, modifiers: { required } })
    default:
      throw new Error(\`toKtValue: schema type '\${schema.type}' is not mapped yet\`)
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
import { KtParameterList, KtSnippet, sanitizePropertyName } from '@skmtc/lang-kotlin'
import { toKtValue } from './Kt.ts'

type DataClassValueArgs = {
  context: GenerateContextType
  objectSchema: OasObject
  destinationPath: string
  modifiers: Modifiers
}

export class DataClassValue extends KtSnippet {
  // The TypeSystem contract fields for the 'object' output — carrying
  // these is what lets the toKtValue router return this snippet as
  // \`TypeSystemOutput<'object'>\`. Every snippet you add for another
  // schema type carries its own output type's fields the same way.
  type = 'object' as const
  recordProperties: null = null
  objectProperties: TypeSystemObjectProperties | null
  modifiers: Modifiers

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
    this.parameterList = new KtParameterList(
      Object.entries(objectSchema.properties ?? {}).map(([wireName, property]) => {
        const value = toKtValue({
          context,
          schema: property,
          destinationPath,
          required: required.includes(wireName)
        })

        properties[wireName] = value

        return {
          name: sanitizePropertyName(wireName),
          type: value,
          nullable: !required.includes(wireName),
          defaultValue: required.includes(wireName) ? undefined : 'null'
        }
      })
    )

    this.objectProperties = { properties }
  }

  override toString(): string {
    return \`\${this.parameterList}\`
  }
}
`
  }

  toModelProjection(mainModule: string) {
    return `import type { ModelProjectionArgs, Stringable } from '@skmtc/core'
import { KtModelBase } from './base.ts'
import { toKtValue } from './Kt.ts'

export class ${mainModule}Projection extends KtModelBase {
  value: Stringable

  constructor(args: ModelProjectionArgs) {
    super(args)

    const { context, refName } = args
    const destinationPath = this.settings.exportPath
    const schema = context.resolveSchemaRefOnce(refName, KtModelBase.id).resolve()

    // Everything flows through the router — 'object' is a case like any
    // other, not a special case here.
    this.value = toKtValue({ context, schema, destinationPath, required: true })
  }

  override toString(): string {
    return \`\${this.value}\`
  }
}
`
  }
}
