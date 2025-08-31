import { Command } from '@cliffy/command'
import { join } from '@std/path/join'
import { parse } from '@std/path/parse'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { ensureFileSync } from '@std/fs/ensure-file'
import { existsSync } from '@std/fs/exists'
import { type ManifestContent, manifestContent } from '@skmtc/core'
import * as v from 'valibot'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import invariant from 'tiny-invariant'

export const toGenerateCommand = (skmtcRoot: SkmtcRoot) => {
  return new Command()
    .description('Generate artifacts from OpenAPI schema')
    .arguments('<project:string>')
    .action(async (_args, projectName) => {
      const project = skmtcRoot.projects.find(({ name }) => name === projectName)

      invariant(project?.schemaFile?.contents, 'Project schema file not found')

      console.log('V1')

      const { artifacts, manifest } = await generatorArtifacts({
        serverOrigin: `https://${project.name}-${project?.clientJson.contents.deploymentId}.deno.dev`,
        schema: project.schemaFile.contents
      })

      deletePreviousArtifacts({
        basePath: project.clientJson.contents.settings.basePath,
        incomingPaths: Object.keys(artifacts ?? {}),
        projectPath: project.toPath()
      })

      const manifestPath = join(project.toPath(), '.settings', 'manifest.json')

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
}
export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}
export const generateResponse: v.GenericSchema<GenerateResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})

export const toGeneratePrompt = async (_skmtcRoot: SkmtcRoot, _projectName: string) => {
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
  console.log('V2')

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
  basePath: string | undefined
  projectPath: string
  incomingPaths: string[]
}

export const deletePreviousArtifacts = ({
  basePath = '',
  incomingPaths,
  projectPath
}: DeletePreviousArtifactsArgs) => {
  const manifestPath = join(projectPath, '.settings', 'manifest.json')

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
        const absolutePath = join(Deno.cwd(), basePath, path)

        Deno.removeSync(absolutePath)
      }
    } catch (_error) {
      // Ignore
      // console.error(`Failed to delete artifact: "${error}"`)
    }
  })
}
