import { Command } from '@cliffy/command'
import { readTextFile, writeFile } from './file.ts'
import { resolve } from '@std/path'
import { Toggle } from '@cliffy/prompt'
import { ensureFileSync } from '@std/fs'

const setupGenerate = async (): Promise<void> => {
  const clientConfig = await getClientConfig()

  // Importing core module dynamically to ensure its
  // version is in sync with generators
  const { generate } = await import('@skmtc/core' + '')

  const { artifacts, manifest, renderDependencies } = await generate({
    schema: getSchemaContent(),
    settings: clientConfig?.settings,
    prettier: await getPrettierConfig(),
    generatorsMap: await loadGenerators()
  })

  writeArtifacts(artifacts)

  writeManifest(manifest)

  writeRenderDependencies(renderDependencies)
}

const writeArtifacts = (artifactsMap: Record<string, string>) => {
  Object.entries(artifactsMap).forEach(([filePath, content]) => {
    const resolvedPath = resolve(filePath)

    ensureFileSync(resolvedPath)

    writeFile({
      content,
      resolvedPath
    })
  })
}

const writeManifest = (manifest: Record<string, unknown>) => {
  const resolvedPath = resolve('.codesquared', 'manifest.json')

  ensureFileSync(resolvedPath)

  writeFile({
    content: JSON.stringify(manifest, undefined, 2),
    resolvedPath
  })
}

const writeRenderDependencies = (renderDependencies: Record<string, unknown>) => {
  const resolvedPath = resolve('.codesquared', 'renderDependencies.json')

  ensureFileSync(resolvedPath)

  writeFile({
    content: JSON.stringify(renderDependencies, undefined, 2),
    resolvedPath
  })
}

type LoadGeneratorsArgs = {
  generatorsPath?: string
}

const loadGenerators = async ({ generatorsPath = 'generators' }: LoadGeneratorsArgs = {}) => {
  const stackConfig = await getStackConfig()

  const stackDenoJsonPath = toLocalPath(generatorsPath, 'deno.json')

  console.log(`Loading generators from ${stackDenoJsonPath}`)

  const { default: stackDenoJson } = await import(stackDenoJsonPath, {
    with: { type: 'json' }
  })

  const generatorsEntries = []

  for await (const generatorName of stackConfig.generators) {
    const isGeneratorDenoJson =
      stackDenoJson.name === generatorName && typeof stackDenoJson.exports === 'string'

    const generatorModule = isGeneratorDenoJson
      ? await import(resolve(stackDenoJson.exports))
      : await import(generatorName)

    const generatorEntry = [generatorModule.default.id, generatorModule.default]

    generatorsEntries.push(generatorEntry)
  }

  return Object.fromEntries(generatorsEntries)
}

type CommandType = Command<
  void,
  void,
  void,
  [],
  void,
  {
    number: number
    integer: number
    string: string
    boolean: boolean
    file: string
  },
  void,
  undefined
>

export const generateCommand = (): CommandType => {
  const command = new Command().description('Generate code from OpenAPI schema').action(() => {
    setupGenerate()
  })

  return command
}

export const createPackageJson = async (): Promise<boolean> => {
  return await Toggle.prompt('Create package.json for external dependencies?')
}

export const generatePrompt = async () => {
  await setupGenerate()
}

const getPrettierConfig = async () => {
  const prettierPath = toLocalPath('.codesquared', '.prettierrc.json')

  const prettier = await import(prettierPath, {
    with: { type: 'json' }
  })

  return prettier.default
}

const getClientConfig = async () => {
  const clientConfigPath = toLocalPath('.codesquared', 'client.json')

  try {
    const clientSettingsModule = await import(clientConfigPath, {
      with: { type: 'json' }
    })

    // Importing core module dynamically to ensure its
    // version is in sync with generators
    const { skmtcClientConfig } = await import('@skmtc/core' + '')

    const clientConfig = skmtcClientConfig.parse(clientSettingsModule.default)

    return clientConfig
  } catch (_e) {
    return undefined
  }
}

const getStackConfig = async () => {
  const stackConfigPath = toLocalPath('.codesquared', 'stack.json')

  const serverSettingsModule = await import(stackConfigPath, {
    with: { type: 'json' }
  })

  // Importing core module dynamically to ensure its
  // version is in sync with generators
  const { skmtcServerConfig } = await import('@skmtc/core' + '')

  const serverConfig = skmtcServerConfig.parse(serverSettingsModule.default)

  return serverConfig
}

const getSchemaContent = () => {
  const jsonSchemaPath = resolve('.codesquared', 'schema.json')

  const jsonSchemaContent = readTextFile(jsonSchemaPath)

  if (jsonSchemaContent) {
    return jsonSchemaContent
  }

  const ymlSchemaPath = resolve('.codesquared', 'schema.yml')

  const ymlSchemaContent = readTextFile(ymlSchemaPath)

  if (ymlSchemaContent) {
    return ymlSchemaContent
  }

  const yamlSchemaPath = resolve('.codesquared', 'schema.yaml')

  const yamlSchemaContent = readTextFile(yamlSchemaPath)

  if (yamlSchemaContent) {
    return yamlSchemaContent
  }

  throw new Error('No schema file found')
}

const toLocalPath = (...path: string[]) => `file://${resolve(...path)}`
