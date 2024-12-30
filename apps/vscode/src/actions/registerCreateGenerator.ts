import { commands, window, workspace } from 'vscode'
import { match } from 'ts-pattern'
import { join } from 'node:path'
import { toRootPath } from '../utilities/getRootPath'
import { existsSync, writeFileSync } from 'node:fs'
import { readStackConfig } from '../utilities/readStackConfig'
import { writeStackConfig } from '../utilities/writeStackConfig'
import { getSession } from '../auth/getSession'
import { ensureFileSync } from 'fs-extra'
import { readDenoJson } from '../utilities/readDenoJson'
import { camelCase } from '@skmtc/core/strings'
import { SkmtcStackConfig } from '@skmtc/core/Settings'

const generatorTypes = ['operation', 'operation-gateway', 'model'] as const

export const registerCreateGenerator = () => {
  return commands.registerCommand('skmtc-vscode.createGenerator', async () => {
    const session = await getSession({ createIfNone: true })

    if (!session) {
      return
    }

    const serverName = session.account.label

    const generatorType = await window.showQuickPick(generatorTypes, {
      placeHolder: 'Select generator type'
    })

    if (
      generatorType !== 'operation' &&
      generatorType !== 'model' &&
      generatorType !== 'operation-gateway'
    ) {
      return
    }

    const stackConfig = readStackConfig({ applyDefault: true })

    const existingNames = stackConfig.generators.map(generator => {
      const [_scope, name] = generator.split('/')

      return name
    })

    const initialGeneratorName = `@${serverName}/`

    const name = await window.showInputBox({
      value: `@${serverName}/`,
      valueSelection: [initialGeneratorName.length, initialGeneratorName.length],
      validateInput: value => {
        if (!value.startsWith(initialGeneratorName)) {
          return `Generator name must start with '${initialGeneratorName}'`
        }

        const packageName = value.substring(initialGeneratorName.length)

        if (existingNames.includes(packageName)) {
          return `Package '${packageName}' already exists`
        }

        if (packageName.length < 2) {
          return 'Package name must be at least 2 characters long'
        }

        if (packageName.length > 20) {
          return 'Package name must be less than 20 characters long'
        }

        if (!/^[a-z0-9-]+$/.test(packageName)) {
          return 'Package name must only contain lowercase letters, numbers and hyphens'
        }

        if (packageName.startsWith('-')) {
          return 'Package name cannot start with a hyphen'
        }

        if (packageName.endsWith('-')) {
          return 'Package name cannot end with a hyphen'
        }

        return null
      }
    })

    if (!name) {
      return
    }

    const transformerPath = await createGenerator({
      serverName,
      packageName: name.substring(initialGeneratorName.length),
      generatorType
    })

    if (!transformerPath) {
      return
    }

    const doc = await workspace.openTextDocument(transformerPath)

    await window.showTextDocument(doc, { preview: false })
  })
}

type CreateGeneratorArgs = {
  serverName: string
  packageName: string
  generatorType: 'operation' | 'model' | 'operation-gateway'
}

const createGenerator = async ({ serverName, packageName, generatorType }: CreateGeneratorArgs) => {
  const skmtcPath = join(toRootPath(), '.codesquared')

  const generatorFolderPath = join(skmtcPath, packageName)

  if (existsSync(generatorFolderPath)) {
    window.showErrorMessage(`Generator folder '${generatorFolderPath}' already exists`)
    return false
  }

  const srcFolderPath = join(generatorFolderPath, 'src')

  const generatorName = `@${serverName}/${packageName}`
  const transformerName = camelCase(packageName, { upperFirst: true })

  const generatorConfigPath = join(srcFolderPath, 'config.ts')
  const transformerPath = join(srcFolderPath, `${transformerName}.ts`)

  const { configContent, transformerContent } = match(generatorType)
    .with('operation', () => ({
      configContent: createOperationConfigContent(generatorName),
      transformerContent: createOperationTransformerContent(transformerName)
    }))
    .with('model', () => ({
      configContent: createModelConfigContent(generatorName),
      transformerContent: createModelTransformerContent(transformerName)
    }))
    .with('operation-gateway', () => ({
      configContent: createOperationGatewayConfigContent(generatorName),
      transformerContent: createOperationGatewayTransformerContent(transformerName)
    }))
    .exhaustive()

  ensureFileSync(generatorConfigPath)
  writeFileSync(generatorConfigPath, configContent)

  ensureFileSync(transformerPath)
  writeFileSync(transformerPath, transformerContent)

  const denoJsonPath = join(generatorFolderPath, 'deno.json')

  ensureFileSync(denoJsonPath)
  writeFileSync(denoJsonPath, createDenoJsonContent({ generatorName }))

  const modTsPath = join(generatorFolderPath, 'mod.ts')

  writeFileSync(modTsPath, createModTsContent({ transformerName }))

  updateStackConfig(generatorName)

  const rootDenoJsonPath = join(skmtcPath, 'deno.json')

  await updateRootDenoJson({ generatorName, rootDenoJsonPath, packageName })

  window.showInformationMessage(`Generator '${generatorName}' created`)

  return transformerPath
}

const createOperationConfigContent = (generatorName: string) => {
  return `import { camelCase, Identifier, toOperationInsertable } from '@skmtc/core';

export const OperationInsertable = toOperationInsertable({
  id: '${generatorName}',

  toIdentifier(operation): Identifier {
    const name = \`\${operation.method}\${camelCase( operation.path, {upperFirst: true})}\`;

    return Identifier.createVariable(name);
  },

  toExportPath( operation ): string {
    return \`\${this.toIdentifier( operation )}.ts\`;
  }
});
`
}

const createOperationGatewayConfigContent = (generatorName: string) => {
  return `import { Identifier, toOperationGateway } from '@skmtc/core';

export const OperationGateway = toOperationGateway({
  id: '${generatorName}',

  toIdentifier(): Identifier {
    const name = 'gateway';

    return Identifier.createVariable(name);
  },

  toExportPath(): string {
    return 'gateway.ts';
  }
});
`
}

const createOperationGatewayTransformerContent = (transformerName: string) => {
  return `import type { OperationGatewayArgs, OasOperation, Stringable, ListArray } from '@skmtc/core';
import { List } from '@skmtc/core';
import { OperationGateway } from './config.ts';

export class ${transformerName} extends OperationGateway {
  list: ListArray<Stringable>;

  constructor({ context, settings }: OperationGatewayArgs) {
    super({ context, settings })

    this.list = List.toArray([])
  }

  tranformOperation(operation: OasOperation): void {
    this.list.values.push('console.log("Implement list item!")')
  }

  override toString(): string {
    return this.list.toString();
  }
}`
}

const createModelConfigContent = (generatorName: string) => {
  return `import { camelCase, Identifier, toModelInsertable } from '@skmtc/core';

export const ModelInsertable = toModelInsertable({
  id: '${generatorName}',

  toIdentifier(operation): Identifier {
    const name = \`\${operation.method}\${camelCase(operation.path, {upperFirst: true})}\`;

    return Identifier.createVariable(name);
  },

  toExportPath(operation): string {
    return \`\${this.toIdentifier(operation)}.ts\`;
  }
});
`
}

const createOperationTransformerContent = (transformerName: string) => {
  return `import type { OperationInsertableArgs } from '@skmtc/core';
import { OperationInsertable } from './config.ts';

export class ${transformerName} extends OperationInsertable {
  constructor({ context, operation, settings }: OperationInsertableArgs) {
    super({ context, operation, settings })
  }

  override toString(): string {
    return \`console.log("Let's do this!")\`;
  }
}`
}

const createModelTransformerContent = (transformerName: string) => {
  return `import type { ModelInsertableArgs } from '@skmtc/core';
import { ModelInsertable } from './config.ts';

export class ${transformerName} extends ModelInsertable {
  constructor({ context, refName, settings }: ModelInsertableArgs) {
    super({ context, refName, settings })
  }

  override toString(): string {
    return \`console.log("Let's do this!")\`;
  }
}`
}

type CreateDenoJsonContentArgs = {
  generatorName: string
}

const createDenoJsonContent = ({ generatorName }: CreateDenoJsonContentArgs) => {
  return `{
    "name": "${generatorName}",
    "version": "0.0.1",
    "exports": "./mod.ts"
  }
`
}

type CreateModTsContentArgs = {
  transformerName: string
}

const createModTsContent = ({ transformerName }: CreateModTsContentArgs) => {
  return `export { ${transformerName}, ${transformerName} as default } from './src/${transformerName}.ts'
  `
}

const updateStackConfig = (generatorName: string) => {
  const stackConfig: SkmtcStackConfig = readStackConfig({
    applyDefault: true
  })

  stackConfig.generators.push(generatorName)

  writeStackConfig(stackConfig)
}

type UpdateRootDenoJsonArgs = {
  generatorName: string
  rootDenoJsonPath: string
  packageName: string
}

const updateRootDenoJson = async ({
  generatorName,
  rootDenoJsonPath,
  packageName
}: UpdateRootDenoJsonArgs) => {
  const denoJsonObject = await readDenoJson(rootDenoJsonPath)

  denoJsonObject.imports[generatorName] = `./${packageName}/mod.ts`

  denoJsonObject.workspace.push(`./${packageName}`)

  writeFileSync(rootDenoJsonPath, JSON.stringify(denoJsonObject, null, 2))
}
