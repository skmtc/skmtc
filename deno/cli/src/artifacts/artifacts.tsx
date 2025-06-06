import { Command } from '@cliffy/command'
import { join, resolve } from '@std/path'
import { existsSync, ensureFileSync } from '@std/fs'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import * as v from 'valibot'
import { skmtcClientConfig, skmtcStackConfig } from '@skmtc/core/Settings'

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

export const toArtifactsCommand = () => {
  return (
    new Command()
      .description('Generate artifacts from OpenAPI schema')
      .arguments('[path]')
      .option('--oas <oas>', 'The OpenAPI schema to generate from')
      // .option('-s, --settings <settings>', 'The settings to use')
      // .option('-p, --prettier [prettier]', 'The prettier config to use')
      .action(async ({ oas }, path = './') => {
        if (!oas) {
          console.error('OAS is required')
          return
        }

        const homePath = resolve(path, '.codesquared')

        const pathToSchema = resolve(homePath, oas)

        const stackJson = await Deno.readTextFile(join(homePath, '.settings', 'stack.json'))
        const stack = v.parse(skmtcStackConfig, JSON.parse(stackJson))

        const clientJson = await Deno.readTextFile(join(homePath, '.settings', 'client.json'))
        const client = v.parse(skmtcClientConfig, JSON.parse(clientJson))

        const schema = await Deno.readTextFile(pathToSchema)

        const { artifacts, manifest } = await generatorArtifacts({
          serverOrigin: `https://${stack.name}-${client.deploymentId}.deno.dev`,
          schema
        })

        deletePreviousArtifacts({
          incomingPaths: Object.keys(artifacts ?? {}),
          homePath
        })

        const manifestPath = join(homePath, '.settings', 'manifest.json')

        ensureFileSync(manifestPath)

        Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2))

        Object.entries(artifacts ?? {}).forEach(([artifactPath, artifactContent]) => {
          const absolutePath = resolve(path, artifactPath)

          ensureFileSync(absolutePath)

          console.log(`Writing artifact: ${absolutePath}`)

          Deno.writeTextFileSync(absolutePath, artifactContent)
        })
      })
  )
}
export type CreateArtifactsResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}
export const createArtifactsResponse: v.GenericSchema<CreateArtifactsResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})

export const toArtifactsPrompt = async () => {
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
    return v.parse(createArtifactsResponse, data)
  } catch (_error) {
    throw new Error('Failed to generate artifacts')
  }
}

type DeletePreviousArtifactsArgs = {
  homePath: string
  incomingPaths: string[]
}

const deletePreviousArtifacts = ({ incomingPaths, homePath }: DeletePreviousArtifactsArgs) => {
  const manifestPath = resolve(homePath, '.settings', 'manifest.json')

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
        const absolutePath = resolve(homePath, path)
        console.log(`Deleting artifact: ${absolutePath}`)
        Deno.removeSync(absolutePath)
      }
    } catch (error) {
      // Ignore
      console.error(`Failed to delete artifact: "${error}"`)
    }
  })
}
