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
import type { RemoteProject } from './remote-project.ts'
export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}
export const generateResponse: v.GenericSchema<GenerateResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})

type DeletePreviousArtifactsArgs = {
  manifestPath: string
  incomingPaths: string[]
}

export const deletePreviousArtifacts = ({
  incomingPaths,
  manifestPath
}: DeletePreviousArtifactsArgs) => {
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
  project: Project | RemoteProject
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
    project.ensureSchemaFile()

    const manifestPath = project.toManifestPath()

    const projectKey = project.toProjectKey()

    const [accountName, serverName] = projectKey.split('/')

    const schema = project.schemaFile?.contents

    invariant(schema, 'Schema not found 1')

    const { artifacts, manifest } = await createApiServersAccountNameServerNameArtifacts({
      supabase: project.manager.auth.supabase,
      accountName,
      serverName,
      body: {
        schema,
        clientSettings: project.clientJson?.contents?.settings,
        prettier: project.prettierJson?.contents
      }
    })

    deletePreviousArtifacts({ incomingPaths: Object.keys(artifacts ?? {}), manifestPath })

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
