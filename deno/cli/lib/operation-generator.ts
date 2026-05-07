import type { Generator } from '@/lib/generator.ts'
import { camelCase } from '@skmtc/core/strings'
import { join } from '@std/path/join'

export class OperationGenerator {
  generator: Generator

  constructor(generator: Generator) {
    this.generator = generator
  }

  async createOperationFiles(generatorPath: string) {
    const srcPath = join(generatorPath, 'src')

    const mainModule = camelCase(this.generator.packageName, { upperFirst: true })

    await Deno.mkdir(srcPath, { recursive: true })

    const modContent = this.toOperationMod(mainModule)
    await Deno.writeTextFile(join(srcPath, 'mod.ts'), modContent)

    const baseContent = this.toOasOperationBase(mainModule)
    await Deno.writeTextFile(join(srcPath, 'base.ts'), baseContent)

    const mainModuleContent = this.toOperationMainModule(mainModule)
    await Deno.writeTextFile(join(srcPath, `${mainModule}.ts`), mainModuleContent)
  }

  toOperationMod(mainModule: string) {
    return `import { toOasOperationEntry } from '@skmtc/core'
import { ${mainModule} } from './${mainModule}.ts'
export const ${mainModule}Entry = toOasOperationEntry({
  id: '${this.generator.toModuleName()}',

  isSupported({ operation }) {
    return true
  },

  transform({ context, operation }) {
    context.insertOperation({ insertable: ${mainModule}, operation })
  }
})`
  }

  toOasOperationBase(mainModule: string) {
    return `import { camelCase, capitalize, Identifier, toMethodVerb, toOasOperationBase } from '@skmtc/core'
import { join } from '@std/path/join'

export const ${mainModule}Base = toOasOperationBase({
  id: '${this.generator.toModuleName()}',

  toIdentifier(operation): Identifier {
    const verb = capitalize(toMethodVerb(operation.method))
    const name = \`\${verb}\${camelCase(operation.path, { upperFirst: true })}\`

    return Identifier.createVariable(name)
  },

  toExportPath(operation): string {
    const { name } = this.toIdentifier(operation)

    return join('@', \`\${name}.generated.tsx\`)
  }
})`
  }

  toOperationMainModule(mainModule: string) {
    return `import type { OasOperationInsertableArgs } from '@skmtc/core'
import { ${mainModule}Base } from './base.ts'

export class ${mainModule} extends ${mainModule}Base {
  constructor({ context, operation, settings }: OasOperationInsertableArgs) {
    super({ context, operation, settings })
  }

  override toString() {
    return \`\`
  }
}`
  }
}
