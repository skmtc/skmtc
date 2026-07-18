import type { Generator } from '@/lib/generator.ts'
import { camelCase } from '@skmtc/core/strings'
import { join } from '@std/path/join'

/**
 * Scaffolds a working Kotlin model generator: every named schema becomes a
 * file-per-model Kotlin declaration (data class / enum class / sealed
 * interface / typealias) in one package, with the doctrine baked into the
 * templates — unconditional `.resolve()`, the 3-way property union,
 * schema→type mapping as a Snippet, `enrichments.ts` always present, and
 * the union-assigns-parent pattern for `oneOf` hierarchies.
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
    await Deno.writeTextFile(join(srcPath, 'KtType.ts'), this.toKtType())
    await Deno.writeTextFile(join(srcPath, 'DataClassValue.ts'), this.toDataClassValue())
    await Deno.writeTextFile(join(srcPath, 'EnumClassValue.ts'), this.toEnumClassValue())
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

    switch (schema.type) {
      case 'object':
        return { type: 'data-class' }
      case 'string':
        return { type: schema.enums?.length ? 'enum-class' : 'typealias' }
      case 'union':
        return { type: 'sealed-interface' }
      default:
        return { type: 'typealias' }
    }
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

  toKtType() {
    return `import type { CustomValue, GenerateContextType, OasRef, OasSchema } from '@skmtc/core'
import { KtSnippet } from '@skmtc/lang-kotlin'

type KtTypeArgs = {
  context: GenerateContextType
  // Object property values are a 3-way union — CustomValue satisfies the
  // same .isRef()/.type narrowing as the schema variants.
  schema: OasSchema | OasRef<'schema'> | CustomValue
  destinationPath: string
}

/**
 * Schema→Kotlin-type mapping as a Snippet: the schema goes in the
 * constructor, the rendering lives in toString(), nested types recurse
 * through child KtType instances, and leaf types self-register their
 * imports. Keep the mapping here — not in string helper functions.
 */
export class KtType extends KtSnippet {
  schema: OasSchema | OasRef<'schema'> | CustomValue
  item: KtType | undefined
  additional: KtType | undefined

  constructor({ context, schema, destinationPath }: KtTypeArgs) {
    super({ context })

    this.schema = schema

    // Genuine .isRef() branch: a $ref renders as the peer's bare class
    // name (same package — imports are suppressed), no recursion needed.
    if (schema.isRef()) {
      return
    }

    switch (schema.type) {
      case 'string': {
        if (schema.format === 'decimal') {
          this.register({ imports: { 'java.math': ['BigDecimal'] }, destinationPath })
        }

        if (schema.format === 'date-time') {
          this.register({ imports: { 'java.time': ['OffsetDateTime'] }, destinationPath })
        }

        break
      }
      case 'array': {
        this.item = new KtType({ context, schema: schema.items, destinationPath })
        break
      }
      case 'object': {
        const { additionalProperties } = schema

        if (additionalProperties !== undefined && typeof additionalProperties !== 'boolean') {
          this.additional = new KtType({ context, schema: additionalProperties, destinationPath })
        }

        break
      }
      default:
        break
    }
  }

  override toString(): string {
    const { schema } = this

    if (schema.isRef()) {
      return schema.toRefName()
    }

    switch (schema.type) {
      case 'string': {
        if (schema.format === 'decimal') {
          return 'BigDecimal'
        }

        if (schema.format === 'date-time') {
          return 'OffsetDateTime'
        }

        return 'String'
      }
      case 'integer':
        return schema.format === 'int64' ? 'Long' : 'Int'
      case 'number':
        return 'Double'
      case 'boolean':
        return 'Boolean'
      case 'array':
        return \`List<\${this.item}>\`
      case 'object':
        return this.additional ? \`Map<String, \${this.additional}>\` : 'Map<String, Any?>'
      default:
        return 'Any?'
    }
  }
}
`
  }

  toDataClassValue() {
    return `import type { GenerateContextType, OasObject, Stringable } from '@skmtc/core'
import { KtParameterList, KtSnippet, sanitizePropertyName } from '@skmtc/lang-kotlin'
import { KtType } from './KtType.ts'

/**
 * The union-membership seams a union parent assigns onto its members
 * during generate (see the projection's 'union' branch). Empty by
 * default, so a standalone schema renders exactly as if unions did not
 * exist.
 */
type UnionSeams = {
  supertypes: Stringable[]
  omittedProperties: Set<string>
}

type DataClassValueArgs = {
  context: GenerateContextType
  schema: OasObject
  destinationPath: string
  owner: UnionSeams
}

type Parameter = {
  wireName: string
  name: string
  type: KtType
  required: boolean
}

export class DataClassValue extends KtSnippet {
  parameters: Parameter[]
  owner: UnionSeams

  constructor({ context, schema, destinationPath, owner }: DataClassValueArgs) {
    super({ context })

    this.owner = owner

    const required = schema.required ?? []

    this.parameters = Object.entries(schema.properties ?? {}).map(([wireName, property]) => ({
      wireName,
      name: sanitizePropertyName(wireName),
      type: new KtType({ context, schema: property, destinationPath }),
      required: required.includes(wireName)
    }))
  }

  override toString(): string {
    // Read the seams at render: a union parent may have assigned them
    // after this value was constructed — generate completes before render,
    // so the final state is always what renders.
    const kept = this.parameters.filter(
      parameter => !this.owner.omittedProperties.has(parameter.wireName)
    )

    const parameterList = new KtParameterList(
      kept.map(({ name, type, required }) => ({
        name,
        type,
        nullable: !required,
        defaultValue: required ? undefined : 'null'
      }))
    )

    const clause = this.owner.supertypes.length ? \` : \${this.owner.supertypes.join(', ')}\` : ''

    return \`\${parameterList}\${clause}\`
  }
}
`
  }

  toEnumClassValue() {
    return `import type { GenerateContextType, OasString } from '@skmtc/core'
import { KtSnippet } from '@skmtc/lang-kotlin'

type EnumClassValueArgs = {
  context: GenerateContextType
  schema: OasString
}

export class EnumClassValue extends KtSnippet {
  constants: string[]

  constructor({ context, schema }: EnumClassValueArgs) {
    super({ context })

    this.constants = (schema.enums ?? []).flatMap(entry =>
      entry === null ? [] : [entry.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()]
    )
  }

  override toString(): string {
    return \` {\\n    \${this.constants.join(',\\n    ')}\\n}\`
  }
}
`
  }

  toModelProjection(mainModule: string) {
    return `import type { ModelProjectionArgs, Stringable } from '@skmtc/core'
import { KtModelBase } from './base.ts'
import { DataClassValue } from './DataClassValue.ts'
import { EnumClassValue } from './EnumClassValue.ts'
import { KtType } from './KtType.ts'

export class ${mainModule}Projection extends KtModelBase {
  // Union-membership seams, assigned by a union parent during generate.
  // A schema does not know it is in a union and behaves as if it is not.
  supertypes: Stringable[] = []
  omittedProperties: Set<string> = new Set()

  value: Stringable

  constructor(args: ModelProjectionArgs) {
    super(args)

    const { context, refName } = args
    const destinationPath = this.settings.exportPath
    const schema = context.resolveSchemaRefOnce(refName, KtModelBase.id).resolve()

    switch (schema.type) {
      case 'object': {
        this.value = new DataClassValue({ context, schema, destinationPath, owner: this })
        break
      }
      case 'string': {
        this.value = schema.enums?.length
          ? new EnumClassValue({ context, schema })
          : new KtType({ context, schema, destinationPath })
        break
      }
      case 'union': {
        // The union assigns membership onto its members. Inserts are
        // idempotent and memoized, so whether the member's own visit or
        // this insert runs first, there is exactly one member instance —
        // visit order does not matter.
        schema.members.forEach(member => {
          if (!member.isRef()) {
            return
          }

          const inserted = context.insertModel(${mainModule}Projection, member.toRefName())

          inserted.definition.value.supertypes.push(refName)

          const discriminator = schema.discriminator?.propertyName

          if (discriminator) {
            inserted.definition.value.omittedProperties.add(discriminator)
          }
        })

        // The bodyless sealed-interface idiom: the value renders nothing.
        this.value = ''
        break
      }
      default: {
        this.value = new KtType({ context, schema, destinationPath })
      }
    }
  }

  override toString(): string {
    return \`\${this.value}\`
  }
}
`
  }
}
