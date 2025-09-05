import { join } from '@std/path/join'
import { parse } from '@std/path/parse'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { ensureFileSync } from '@std/fs/ensure-file'
import type { SkmtcRoot } from './skmtc-root.ts'
import * as v from 'valibot'
import type { Project } from './project.ts'
import invariant from 'tiny-invariant'
import { getApiWorkspacesWorkspaceName } from '../services/getApiWorkspacesWorkspaceName.generated.ts'
import { existsSync } from '@std/fs/exists'
import { type ManifestContent, manifestContent } from '@skmtc/core'
import { createApiServersAccountNameServerNameArtifacts } from '@/services/createApiServersAccountNameServerNameArtifacts.generated.ts'

export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}
export const generateResponse: v.GenericSchema<GenerateResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})

type DeletePreviousArtifactsArgs = {
  projectPath: string
  incomingPaths: string[]
}

export const deletePreviousArtifacts = ({
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
        const absolutePath = join(Deno.cwd(), path)

        Deno.removeSync(absolutePath)
      }
    } catch (_error) {
      // Ignore
      // console.error(`Failed to delete artifact: "${error}"`)
    }
  })
}

type GenerateArtifactsArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
}

type GetWorkspaceArgs = {
  project: Project
  skmtcRoot: SkmtcRoot
}

export class Workspace {
  async getWorkspace({ project, skmtcRoot }: GetWorkspaceArgs) {
    const workspace = await getApiWorkspacesWorkspaceName({
      workspaceName: project.name,
      supabase: skmtcRoot.manager.auth.supabase
    })

    invariant(workspace, 'Workspace not found')

    return workspace
  }

  async generateArtifacts({ project }: GenerateArtifactsArgs): Promise<GenerateResponse> {
    if (!project.schemaFile) {
      throw new Error(
        `Project has no schema file. Add an "openapi.json" or "openapi.yaml" file to ".skmtc/${project.name}" or ".skmtc" folder.`
      )
    }

    const manifestPath = join(project.toPath(), '.settings', 'manifest.json')

    const { projectKey } = project.clientJson.contents

    if (!projectKey) {
      throw new Error(
        'Project is missing "projectKey" in ".settings/client.json". Has it been deployed?'
      )
    }

    const [accountName, serverName] = projectKey.split('/')

    invariant(accountName, 'Account name not found')
    invariant(serverName, 'Server name not found')

    const { artifacts, manifest } = await createApiServersAccountNameServerNameArtifacts({
      supabase: project.manager.auth.supabase,
      accountName,
      serverName,
      body: {
        schema: project.schemaFile?.contents,
        clientSettings: project.clientJson.contents?.settings,
        prettier: project.prettierJson?.contents
      }
    })

    deletePreviousArtifacts({
      incomingPaths: Object.keys(artifacts ?? {}),
      projectPath: project.toPath()
    })

    ensureFileSync(manifestPath)

    Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2))

    Object.entries(artifacts ?? {}).forEach(([artifactPath, artifactContent]) => {
      const cwd = Deno.cwd()

      const absolutePath = join(cwd, artifactPath)

      const { dir } = parse(absolutePath)

      ensureDirSync(dir)

      Deno.writeTextFileSync(absolutePath, artifactContent)
    })

    return { manifest, artifacts }
  }
}
