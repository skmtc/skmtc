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

    const baseContent = this.toOasOperationProjectionBase(mainModule)
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
    context.insertOperation({ projection: ${mainModule}, operation })
  }
})`
  }

  toOasOperationProjectionBase(mainModule: string) {
    return `import { camelCase, capitalize, toMethodVerb } from '@skmtc/core'
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import type { TsIdentifierType } from '@skmtc/lang-typescript'
import { join } from '@std/path/join'

export const ${mainModule}Base = toTsOasOperationProjectionBase({
  id: '${this.generator.toModuleName()}',

  toIdentifierName({ operation }): string {
    const verb = capitalize(toMethodVerb(operation.method))

    return \`\${verb}\${camelCase(operation.path, { upperFirst: true })}\`
  },

  toIdentifierType(): TsIdentifierType {
    return { type: 'variable' }
  },

  toExportPath({ operation, enrichments, variant }): string {
    const name = this.toIdentifierName({ operation, enrichments, variant })

    return join('@', \`\${name}.generated.tsx\`)
  }
})`
  }

  toOperationMainModule(mainModule: string) {
    return `import type { OasOperationProjectionConstructorArgs } from '@skmtc/core'
import { ${mainModule}Base } from './base.ts'

export class ${mainModule} extends ${mainModule}Base {
  constructor({ context, operation, settings }: OasOperationProjectionConstructorArgs) {
    super({ context, operation, settings })
  }

  override toString() {
    return \`\`
  }
}`
  }
}
