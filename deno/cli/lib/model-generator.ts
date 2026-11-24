import type { Generator } from '@/lib/generator.ts'
import { camelCase } from '@skmtc/core/strings'
import { join } from '@std/path/join'

export class ModelGenerator {
  generator: Generator

  constructor(generator: Generator) {
    this.generator = generator
  }

  async createModelFiles(generatorPath: string) {
    const srcPath = join(generatorPath, 'src')

    const mainModule = camelCase(this.generator.packageName, { upperFirst: true })

    await Deno.mkdir(srcPath, { recursive: true })

    const modContent = this.toModelMod(mainModule)
    await Deno.writeTextFile(join(srcPath, 'mod.ts'), modContent)

    const baseContent = this.toModelProjectionBase(mainModule)
    await Deno.writeTextFile(join(srcPath, 'base.ts'), baseContent)

    const projectionContent = this.toModelProjection(mainModule)
    await Deno.writeTextFile(join(srcPath, `${mainModule}Projection.ts`), projectionContent)
  }

  toModelMod(mainModule: string) {
    return `import { emptyEnrichmentSchema, toModelEntry } from '@skmtc/core'
import { ${mainModule}Projection } from './${mainModule}Projection.ts'

export const ${camelCase(this.generator.packageName)}Entry = toModelEntry({
  id: '${this.generator.toModuleName()}',

  toEnrichmentSchema: () => emptyEnrichmentSchema,

  transform({ context, ref }) {
    context.insertModel(${mainModule}Projection, ref)
  }
})`
  }

  toModelProjectionBase(mainModule: string) {
    return `import { decapitalize, camelCase, emptyEnrichmentSchema } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import type { TsIdentifierType } from '@skmtc/lang-typescript'

export const ${mainModule}Base = toTsModelProjectionBase({
  id: '${this.generator.toModuleName()}',

  toIdentifierName({ ref }): string {
    return decapitalize(camelCase(ref.refName))
  },

  toIdentifierType(): TsIdentifierType {
    return { type: 'variable' }
  },

  toExportPath({ ref, enrichments, variant }): string {
    const name = this.toIdentifierName({ ref, enrichments, variant })

    // The engine injects the generated-file suffix (settings.generatedSuffix,
    // default '.generated') when this result is stored into ContentSettings.
    return \`@/types/\${decapitalize(name)}.tsx\`
  },

  toEnrichmentSchema: () => emptyEnrichmentSchema
})
`
  }

  toModelProjection(mainModule: string) {
    return `import type { TypeSystemValue, GenerateContext, RefParts, ContentSettings, EmptyEnrichments } from '@skmtc/core'
import { to${mainModule}Value } from './${mainModule}.ts'
import { ${mainModule}Base } from './base.ts'

type ConstructorArgs = {
  context: GenerateContext
  destinationPath: string
  ref: RefParts
  // Matches the base's \`toEnrichmentSchema: () => emptyEnrichmentSchema\`.
  settings: ContentSettings<EmptyEnrichments>
  rootRef?: RefParts
}

export class ${mainModule}Projection extends ${mainModule}Base {
  value: TypeSystemValue
  constructor({ context, ref, settings, destinationPath, rootRef }: ConstructorArgs) {
    super({ context, ref, settings })

    const schema = context.resolveSchemaRefOnce(ref)

    this.value = to${mainModule}Value({
      schema,
      required: true,
      destinationPath,
      context,
      rootRef
    })
  }

  override toString() {
    return \`\${this.value}\`
  }
}`
  }
}
