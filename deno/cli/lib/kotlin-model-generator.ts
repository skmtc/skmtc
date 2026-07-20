import type { Generator } from '@/lib/generator.ts'
import { camelCase } from '@skmtc/core/strings'
import { join } from '@std/path/join'

/**
 * Scaffolds a Kotlin model generator SKELETON: the mechanical wiring only
 * (entry, projection base, one projection, a data-class parameter-list
 * snippet, `enrichments.ts`), plus an empty `toKtValue` router typed
 * `SchemaToValueFn` that throws on every schema type. The skeleton
 * bundles and type-checks; `generate` fails loudly until the author
 * implements the schema→snippet mapping — one self-rendering snippet per
 * schema variant, the gen-zod / gen-typescript shape. Deliberately
 * carries NO answers: no enum/union handling, no format policy, no
 * serialization annotations — that is generator authoring, guided by the
 * skmtc-generator and skmtc-lang-kotlin skills.
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
  // set it to "" when the consumer requires exact filenames.
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

/**
 * Maps a parsed schema node to a self-rendering Kotlin snippet — the
 * generator's central seam, deliberately unimplemented in this skeleton.
 *
 * Implement it as the reference generators do (gen-zod's \`toZodValue\`,
 * gen-typescript's \`Ts.ts\`): one case per \`schema.type\`, each returning
 * a small snippet class that takes the TYPED schema variant, extracts its
 * facts in the constructor, renders itself in \`toString()\`, and
 * registers its own imports. The router routes and constructs — it never
 * builds strings.
 */
export const toKtValue: SchemaToValueFn = ({
  schema,
  destinationPath,
  required,
  context,
  rootRef
}) => {
  switch (schema.type) {
    // case 'string':
    //   return new KtString({ context, stringSchema: schema, destinationPath, required })
    default:
      throw new Error(\`toKtValue: schema type '\${schema.type}' is not mapped yet\`)
  }
}
`
  }

  toDataClassValue() {
    return `import type { GenerateContextType, OasObject, Stringable } from '@skmtc/core'
import { KtParameterList, KtSnippet, sanitizePropertyName } from '@skmtc/lang-kotlin'
import { toKtValue } from './Kt.ts'

type DataClassValueArgs = {
  context: GenerateContextType
  schema: OasObject
  destinationPath: string
}

type Parameter = {
  wireName: string
  name: string
  type: Stringable
  required: boolean
}

export class DataClassValue extends KtSnippet {
  parameters: Parameter[]

  constructor({ context, schema, destinationPath }: DataClassValueArgs) {
    super({ context })

    const required = schema.required ?? []

    this.parameters = Object.entries(schema.properties ?? {}).map(([wireName, property]) => ({
      wireName,
      name: sanitizePropertyName(wireName),
      required: required.includes(wireName),
      // Routed through the toKtValue seam; snippets it constructs register
      // their imports here, in the constructor, never at render.
      type: toKtValue({
        context,
        schema: property,
        destinationPath,
        required: required.includes(wireName)
      })
    }))
  }

  override toString(): string {
    const parameterList = new KtParameterList(
      this.parameters.map(({ name, type, required }) => ({
        name,
        type,
        nullable: !required,
        defaultValue: required ? undefined : 'null'
      }))
    )

    return \`\${parameterList}\`
  }
}
`
  }

  toModelProjection(mainModule: string) {
    return `import type { ModelProjectionArgs, Stringable } from '@skmtc/core'
import { KtModelBase } from './base.ts'
import { DataClassValue } from './DataClassValue.ts'
import { toKtValue } from './Kt.ts'

export class ${mainModule}Projection extends KtModelBase {
  value: Stringable

  constructor(args: ModelProjectionArgs) {
    super(args)

    const { context, refName } = args
    const destinationPath = this.settings.exportPath
    const schema = context.resolveSchemaRefOnce(refName, KtModelBase.id).resolve()

    this.value =
      schema.type === 'object'
        ? new DataClassValue({ context, schema, destinationPath })
        : toKtValue({ context, schema, destinationPath, required: true })
  }

  override toString(): string {
    return \`\${this.value}\`
  }
}
`
  }
}
