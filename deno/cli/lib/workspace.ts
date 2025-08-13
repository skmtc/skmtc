import { deletePreviousArtifacts, generateResponse } from '../generators/generate.ts'
import { join, parse } from '@std/path'
import { ensureDirSync, ensureFileSync } from '@std/fs'
import type { SkmtcRoot } from './skmtc-root.ts'
import * as v from 'valibot'
import type { Project } from './project.ts'
import invariant from 'tiny-invariant'

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
    const workspace = await skmtcRoot.apiClient.getWorkspaceByName(project.name)

    invariant(workspace, 'Workspace not found')

    return workspace
  }

  async generateArtifacts({ project }: GenerateArtifactsArgs) {
    const manifestPath = join(project.toPath(), '.settings', 'manifest.json')

    const { deploymentId } = project.clientJson.contents

    const generatorUrl = `https://${project.name}-${deploymentId}.deno.dev/artifacts`

    const res = await fetch(generatorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schema: project.schemaFile?.contents,
        clientSettings: project.clientJson.contents,
        prettierJson: project.prettierJson?.contents
      })
    })

    const data = await res.json()

    const { artifacts, manifest } = v.parse(generateResponse, data)

    const basePath = project.clientJson.contents.settings.basePath ?? ''

    deletePreviousArtifacts({
      incomingPaths: Object.keys(artifacts ?? {}).map(path => join(basePath, path)),
      projectPath: project.toPath(),
      basePath
    })

    ensureFileSync(manifestPath)

    Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2))

    Object.entries(artifacts ?? {}).forEach(([artifactPath, artifactContent]) => {
      const absolutePath = join(Deno.cwd(), basePath, artifactPath)

      const { dir } = parse(absolutePath)

      ensureDirSync(dir)

      Deno.writeTextFileSync(absolutePath, artifactContent)
    })
  }
}
