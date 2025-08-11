import { deletePreviousArtifacts } from '../generators/generate.ts'
import { join, parse } from '@std/path'
import { ensureDirSync, ensureFileSync } from '@std/fs'
import { toProjectPath } from './to-project-path.ts'
import type { SkmtcRoot } from './skmtc-root.ts'

type GenerateArtifactsArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
}

type GetWorkspaceArgs = {
  projectName: string
  skmtcRoot: SkmtcRoot
}

export class Workspace {
  async getWorkspace({ projectName, skmtcRoot }: GetWorkspaceArgs) {
    const workspace = await skmtcRoot.apiClient.getWorkspaceByName(projectName)

    return workspace
  }

  async generateArtifacts({ projectName, skmtcRoot }: GenerateArtifactsArgs) {
    const workspace = await this.getWorkspace({ projectName, skmtcRoot })

    const { artifacts, manifest } = await skmtcRoot.apiClient.generateArtifacts({
      workspaceId: workspace.id
    })

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
