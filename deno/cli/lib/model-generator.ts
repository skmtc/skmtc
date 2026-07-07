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

  transform({ context, refName }) {
    context.insertModel(${mainModule}Projection, refName)
  }
})`
  }

  toModelProjectionBase(mainModule: string) {
    return `import { decapitalize, camelCase, emptyEnrichmentSchema } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import type { TsIdentifierType } from '@skmtc/lang-typescript'
import { join } from '@std/path/join'

export const ${mainModule}Base = toTsModelProjectionBase({
  id: '${this.generator.toModuleName()}',

  toIdentifierName({ refName }): string {
    return decapitalize(camelCase(refName))
  },

  toIdentifierType(): TsIdentifierType {
    return { type: 'variable' }
  },

  toExportPath({ refName, enrichments, variant }): string {
    const name = this.toIdentifierName({ refName, enrichments, variant })

    return join('@', 'types', \`\${decapitalize(name)}.generated.tsx\`)
  },

  toEnrichmentSchema: () => emptyEnrichmentSchema
})
`
  }

  toModelProjection(mainModule: string) {
    return `import type { TypeSystemValue, GenerateContext, RefName, ContentSettings } from '@skmtc/core'
import { to${mainModule}Value } from './${mainModule}.ts'
import { ${mainModule}Base } from './base.ts'

type ConstructorArgs = {
  context: GenerateContext
  destinationPath: string
  refName: RefName
  settings: ContentSettings
  rootRef?: RefName
}

export class ${mainModule}Projection extends ${mainModule}Base {
  value: TypeSystemValue
  constructor({ context, refName, settings, destinationPath, rootRef }: ConstructorArgs) {
    super({ context, refName, settings })

    const schema = context.resolveSchemaRefOnce(refName, ${mainModule}Base.id)

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
