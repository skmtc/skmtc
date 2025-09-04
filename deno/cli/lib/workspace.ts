import {
  deletePreviousArtifacts,
  generateResponse,
  type GenerateResponse
} from '../generators/generate.ts'
import { join } from '@std/path/join'
import { parse } from '@std/path/parse'
import { ensureDirSync } from '@std/fs/ensure-dir'
import { ensureFileSync } from '@std/fs/ensure-file'
import type { SkmtcRoot } from './skmtc-root.ts'
import * as v from 'valibot'
import type { Project } from './project.ts'
import invariant from 'tiny-invariant'
import { getApiWorkspacesWorkspaceName } from '../services/getApiWorkspacesWorkspaceName.generated.ts'

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

    const { serverOrigin } = project.clientJson.contents

    if (!serverOrigin) {
      throw new Error(
        'Project is missing "serverOrigin" in ".settings/client.json". Has it been deployed?'
      )
    }

    const res = await fetch(`${serverOrigin}/artifacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schema: project.schemaFile?.contents,
        clientSettings: project.clientJson.contents?.settings,
        prettier: project.prettierJson?.contents
      })
    })

    if (!res.ok) {
      console.log(await res.text())
      throw new Error('Failed to generate artifacts')
    }

    const data = await res.json()

    const { artifacts, manifest } = v.parse(generateResponse, data)

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
