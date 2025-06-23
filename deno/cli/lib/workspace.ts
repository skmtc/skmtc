import type { ApiClient } from './api-client.ts'
import type { KvState } from './kv-state.ts'
import { deletePreviousArtifacts } from '../generators/generate.ts'
import { toRootPath } from './to-root-path.ts'
import { join, parse } from '@std/path'
import { ensureDirSync, ensureFileSync } from '@std/fs'

type GenerateArtifactsArgs = {
  kvState: KvState
  apiClient: ApiClient
}

export class Workspace {
  async generateArtifacts({ kvState, apiClient }: GenerateArtifactsArgs) {
    const workspaceId = await kvState.getWorkspaceId()

    if (!workspaceId) {
      throw new Error('Workspace id not found')
    }

    const { artifacts, manifest } = await apiClient.generateArtifacts({ workspaceId })

    const rootPath = toRootPath()

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

      console.log('WRITING', absolutePath)

      Deno.writeTextFileSync(absolutePath, artifactContent)
    })
  }
}
