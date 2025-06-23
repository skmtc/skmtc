import { Command } from '@cliffy/command'
import { join, parse } from '@std/path'
import { ensureDirSync, ensureFileSync, existsSync } from '@std/fs'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import * as v from 'valibot'
import { skmtcClientConfig, skmtcStackConfig } from '@skmtc/core/Settings'
import { toRootPath } from '../lib/to-root-path.ts'

export type FormFieldItem = {
  id: string
  accessorPath: string[]
  input: string
  label: string
  placeholder?: string
}

export type FormItem = {
  title: string
  fields: FormFieldItem[]
}

export type TableColumnItem = {
  id: string
  accessorPath: string[]
  formatter: string
  label: string
}

export type InputOptionConfigItem = {
  id: string
  accessorPath: string[]
  formatter: string
}

type OperationEnrichments = {
  columns: TableColumnItem[]
  form: FormItem
  optionLabel: InputOptionConfigItem
}

type MethodEnrichments = Record<string, OperationEnrichments>
type PathEnrichments = Record<string, MethodEnrichments>
export type GeneratorEnrichments = Record<string, PathEnrichments>

export const toGenerateCommand = () => {
  return (
    new Command()
      .description('Generate artifacts from OpenAPI schema')
      .arguments('<path:string>')
      // .option('-s, --settings <settings>', 'The settings to use')
      // .option('-p, --prettier [prettier]', 'The prettier config to use')
      .action(async (_args, path) => {
        const rootPath = toRootPath()

        const pathToSchema = join(Deno.cwd(), path)

        const stackJson = await Deno.readTextFile(join(rootPath, '.settings', 'stack.json'))
        const stack = v.parse(skmtcStackConfig, JSON.parse(stackJson))

        const clientJson = await Deno.readTextFile(join(rootPath, '.settings', 'client.json'))
        const client = v.parse(skmtcClientConfig, JSON.parse(clientJson))

        const schema = await Deno.readTextFile(pathToSchema)

        const { artifacts, manifest } = await generatorArtifacts({
          serverOrigin: `https://${stack.name}-${client.deploymentId}.deno.dev`,
          schema
        })

        deletePreviousArtifacts({
          incomingPaths: Object.keys(artifacts ?? {}),
          rootPath
        })

        const manifestPath = join(rootPath, '.settings', 'manifest.json')

        ensureFileSync(manifestPath)

        Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2))

        Object.entries(artifacts ?? {}).forEach(([artifactPath, artifactContent]) => {
          const absolutePath = join(Deno.cwd(), artifactPath)

          const { dir } = parse(absolutePath)

          ensureDirSync(dir)

          console.log(`Writing artifact: ${absolutePath}`)

          Deno.writeTextFileSync(absolutePath, artifactContent)
        })
      })
  )
}
export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}
export const generateResponse: v.GenericSchema<GenerateResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})

export const toGeneratePrompt = async () => {
  console.log('generate prompt')
}

type GenerateArgs = {
  serverOrigin: string
  // clientSettings: ClientSettings | undefined
  // prettier?: any
  schema: string
}

export const generatorArtifacts = async ({
  serverOrigin,
  // clientSettings,
  // prettier,
  schema
}: GenerateArgs) => {
  const response = await fetch(`${serverOrigin}/artifacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ schema })
  })

  const data = await response.json()

  try {
    return v.parse(generateResponse, data)
  } catch (_error) {
    throw new Error('Failed to generate artifacts')
  }
}

type DeletePreviousArtifactsArgs = {
  rootPath: string
  incomingPaths: string[]
}

export const deletePreviousArtifacts = ({
  incomingPaths,
  rootPath
}: DeletePreviousArtifactsArgs) => {
  const manifestPath = join(rootPath, '.settings', 'manifest.json')

  if (!existsSync(manifestPath)) {
    return
  }

  const manifest = Deno.readTextFileSync(manifestPath)

  const manifestFile = v.parse(manifestContent, JSON.parse(manifest))

  if (!manifest) {
    return
  }

  const paths = Object.keys(manifestFile.files)

  paths.forEach(path => {
    try {
      if (!incomingPaths.includes(path)) {
        const absolutePath = join(Deno.cwd(), path)
        console.log(`Deleting artifact: ${absolutePath}`)
        Deno.removeSync(absolutePath)
      }
    } catch (error) {
      // Ignore
      console.error(`Failed to delete artifact: "${error}"`)
    }
  })
}
