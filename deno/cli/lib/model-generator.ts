import type { Generator } from './generator.ts'
import { camelCase } from '@skmtc/core'
import { join } from '@std/path'

export class ModelGenerator {
  generator: Generator

  constructor(generator: Generator) {
    this.generator = generator
  }

  async createModelFiles(generatorPath: string) {
    const srcPath = join(generatorPath, 'src')

    const mainModule = camelCase(this.generator.generatorName, { upperFirst: true })

    await Deno.mkdir(srcPath, { recursive: true })

    const modContent = this.toModelMod(mainModule)
    await Deno.writeTextFile(join(srcPath, 'mod.ts'), modContent)

    const baseContent = this.toModelBase(mainModule)
    await Deno.writeTextFile(join(srcPath, 'base.ts'), baseContent)

    const insertableContent = this.toModelInsertable(mainModule)
    await Deno.writeTextFile(join(srcPath, `${mainModule}Insertable.ts`), insertableContent)
  }

  toModelMod(mainModule: string) {
    return `import { toModelEntry } from '@skmtc/core'
import { ${mainModule}Insertable } from './${mainModule}Insertable.ts'

export const ${this.generator.generatorName}Entry = toModelEntry({
  id: '${this.generator.toPackageName()}',

  transform({ context, refName }) {
    context.insertModel(${mainModule}Insertable, refName)
  }
})`
  }

  toModelBase(mainModule: string) {
    return `import { decapitalize, Identifier, toModelBase, type RefName, camelCase } from '@skmtc/core'
import { join } from '@std/path'

export const ${mainModule}Base = toModelBase({
  id: '${this.generator.toPackageName()}',

  toIdentifier(refName: RefName): Identifier {
    const name = decapitalize(camelCase(refName))

    return Identifier.createVariable(name)
  },

  toExportPath(refName: RefName): string {
    const { name } = this.toIdentifier(refName)

    return join('@', 'types', \`\${decapitalize(name)}.generated.tsx\`)
  }
})
`
  }

  toModelInsertable(mainModule: string) {
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

export class ${mainModule}Insertable extends ${mainModule}Base {
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
