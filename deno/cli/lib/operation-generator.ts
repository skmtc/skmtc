import type { Generator } from './generator.ts'
import { camelCase } from '@skmtc/core'
import { join } from '@std/path'

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

    const baseContent = this.toOperationBase(mainModule)
    await Deno.writeTextFile(join(srcPath, 'base.ts'), baseContent)

    const mainModuleContent = this.toOperationMainModule(mainModule)
    await Deno.writeTextFile(join(srcPath, `${mainModule}.ts`), mainModuleContent)
  }

  toOperationMod(mainModule: string) {
    return `import { toOperationEntry } from '@skmtc/core'
import { ${mainModule} } from './${mainModule}.ts'
export const ${mainModule}Entry = toOperationEntry({
  id: '${this.generator.toModuleName()}',

  isSupported({ operation }) {
    return true
  },

  transform({ context, operation }) {
    context.insertOperation(${mainModule}, operation)
  }
})`
  }

  toOperationBase(mainModule: string) {
    return `import { camelCase, capitalize, Identifier, toMethodVerb, toOperationBase } from '@skmtc/core'
import { join } from '@std/path'

export const ${mainModule}Base = toOperationBase({
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
    return `import type { OperationInsertableArgs } from '@skmtc/core'
import { ${mainModule}Base } from './base.ts'

export class ${mainModule} extends ${mainModule}Base {
  constructor({ context, operation, settings }: OperationInsertableArgs) {
    super({ context, operation, settings })
  }

  override toString() {
    return \`\`
  }
}`
  }
}
