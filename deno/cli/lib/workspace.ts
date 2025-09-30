import { join } from '@std/path/join'
import { parse } from '@std/path/parse'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { ensureFileSync } from '@std/fs/ensure-file'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import * as v from 'valibot'
import type { Project } from '@/lib/project.ts'
import invariant from 'tiny-invariant'
import { getApiWorkspacesWorkspaceName } from '@/services/getApiWorkspacesWorkspaceName.generated.ts'
import { existsSync } from '@std/fs/exists'
import { type ManifestContent, manifestContent } from '@skmtc/core'
import { createApiServersAccountNameServerNameArtifacts } from '@/services/createApiServersAccountNameServerNameArtifacts.generated.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { toRootPath } from '@/lib/to-root-path.ts'
import type { ClientSettings } from '@/types/clientSettings.generated.ts'
import type { PrettierConfigType } from '@/types/prettierConfigType.generated.ts'
import { createArtifactsResponse } from '@/types/createArtifactsResponse.generated.ts'
export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}
export const generateResponse: v.GenericSchema<GenerateResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})

type DeletePreviousArtifactsArgs = {
  skmtcRootPath: string
  manifestPath: string
  incomingPaths: string[]
}

export const deletePreviousArtifacts = ({
  skmtcRootPath,
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
        const absolutePath = join(skmtcRootPath, '..', path)

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
  schemaContents: string
  clientSettings: ClientSettings | undefined
  prettier: PrettierConfigType | undefined
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

  async generateArtifacts({
    project,
    schemaContents,
    clientSettings,
    prettier
  }: GenerateArtifactsArgs): Promise<GenerateResponse> {
    await project.ensureSchemaFile()

    const manifestPath = project.toManifestPath()

    const { artifacts, manifest } = project.clientJson.contents?.serverUrl
      ? await generateLocal({
          schema: schemaContents,
          clientSettings,
          prettier,
          localUrl: project.clientJson.contents?.serverUrl
        })
      : await generateRemote({
          project,
          schema: schemaContents,
          clientSettings,
          prettier
        })

    const skmtcRootPath = toRootPath()

    deletePreviousArtifacts({
      incomingPaths: Object.keys(artifacts ?? {}),
      manifestPath,
      skmtcRootPath
    })

    ensureFileSync(manifestPath)

    Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2))

    Object.entries(artifacts ?? {}).forEach(([artifactPath, artifactContent]) => {
      const absolutePath = join(skmtcRootPath, '..', artifactPath)

      const { dir } = parse(absolutePath)

      ensureDirSync(dir)

      Deno.writeTextFileSync(absolutePath, artifactContent)
    })

    return { manifest, artifacts }
  }
}

type GenerateRemoteArgs = {
  project: Project | RemoteProject
  schema: string
  clientSettings: ClientSettings | undefined
  prettier: PrettierConfigType | undefined
}

const generateRemote = async ({
  project,
  schema,
  clientSettings,
  prettier
}: GenerateRemoteArgs) => {
  const projectKey = project.toProjectKey()

  const [accountName, serverName] = projectKey.split('/')

  return await createApiServersAccountNameServerNameArtifacts({
    supabase: project.manager.auth.supabase,
    accountName,
    serverName,
    body: {
      schema,
      clientSettings,
      prettier
    }
  })
}

type GenerateLocalArgs = {
  localUrl: string
  schema: string
  clientSettings: ClientSettings | undefined
  prettier: PrettierConfigType | undefined
}

const generateLocal = async ({ localUrl, schema, clientSettings, prettier }: GenerateLocalArgs) => {
  const res = await fetch(`${localUrl}/artifacts`, {
    method: 'POST',
    body: JSON.stringify({
      schema,
      clientSettings,
      prettier
    })
  })

  const data = await res.json()

  return createArtifactsResponse.parse(data)
}
