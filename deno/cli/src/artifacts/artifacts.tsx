import { Command } from '@cliffy/command'
import { join, resolve } from '@std/path'
import { existsSync } from '@std/fs'
import { ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import * as v from 'valibot'

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

        const schema = await Deno.readTextFile(pathToSchema)

        const { artifacts, manifest } = await generatorArtifacts({
          serverOrigin: 'https://doc-types-qkcgy8zw0kat.deno.dev',
          schema
        })

        deletePreviousArtifacts({
          incomingPaths: Object.keys(artifacts ?? {}),
          homePath
        })

        Deno.writeTextFileSync(
          join(homePath, '.settings', 'manifest.json'),
          JSON.stringify(manifest, null, 2),
          { create: true }
        )

        Object.entries(artifacts ?? {}).forEach(([artifactPath, artifactContent]) => {
          const absolutePath = resolve(path, artifactPath)
          console.log(`Writing artifact: ${absolutePath}`)

          Deno.writeTextFileSync(absolutePath, artifactContent, { create: true })
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
