import type { ApiClient } from './api-client.ts'
import type { KvState } from './kv-state.ts'
import { deletePreviousArtifacts } from '../generators/generate.ts'
import { join, parse } from '@std/path'
import { ensureDirSync, ensureFileSync } from '@std/fs'
import { toProjectPath } from './to-project-path.ts'

type GenerateArtifactsArgs = {
  projectName: string
  kvState: KvState
  apiClient: ApiClient
}

type GetWorkspaceArgs = {
  projectName: string
  kvState: KvState
  apiClient: ApiClient
}

export class Workspace {
  async getWorkspace({ projectName, kvState, apiClient }: GetWorkspaceArgs) {
    const workspaceId = await kvState.getWorkspaceId(projectName)

    if (!workspaceId || typeof workspaceId !== 'string') {
      console.log('No workspace ID found')
      return
    }

    const workspace = await apiClient.getWorkspaceById(workspaceId)

    return workspace
  }

  async generateArtifacts({ projectName, kvState, apiClient }: GenerateArtifactsArgs) {
    const workspaceId = await kvState.getWorkspaceId(projectName)

    if (!workspaceId) {
      throw new Error('Workspace id not found')
    }

    const { artifacts, manifest } = await apiClient.generateArtifacts({ workspaceId })

    const projectPath = toProjectPath(projectName)

    deletePreviousArtifacts({
      incomingPaths: Object.keys(artifacts ?? {}),
      projectPath
    })

    const manifestPath = join(projectPath, '.settings', 'manifest.json')

    ensureFileSync(manifestPath)

    Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2))

    Object.entries(artifacts ?? {}).forEach(([artifactPath, artifactContent]) => {
      const absolutePath = join(Deno.cwd(), artifactPath)

      const { dir } = parse(absolutePath)

      ensureDirSync(dir)

      Deno.writeTextFileSync(absolutePath, artifactContent)
    })
  }
}
