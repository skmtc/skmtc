import { join } from '@std/path/join'
import { Project } from '@/lib/project.ts'
import { RemoteProject } from '@/lib/remote-project.ts'
import type { ClientSettings } from '@/types/clientSettings.generated.ts'
import { generateSandboxApi } from '@/services/generateSandboxApi.ts'
import { generateWithWorker } from './generate-worker.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'

type GenerateArtifactsArgs = {
  project: Project | RemoteProject
  schemaContents: string
  clientSettings: ClientSettings | undefined
  accountName: string
  token: string | undefined
}

export const generateArtifacts = async ({
  project,
  schemaContents,
  clientSettings,
  accountName,
  token
}: GenerateArtifactsArgs): Promise<GenerateResponse> => {
  if (project instanceof Project) {
    return await generateWithWorker({
      schemaContents,
      clientSettings,
      workerPath: join(project.toPath(), 'bundle.js')
    })
  }

  if (project instanceof RemoteProject) {
    return await generateSandboxApi({
      accountName: accountName,
      serverName: project.name,
      schema: schemaContents,
      clientSettings,
      token
    })
  }

  throw new Error('Invalid project')
}
