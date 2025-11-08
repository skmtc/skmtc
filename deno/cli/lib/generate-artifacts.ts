import type { ClientSettings } from '@/types/clientSettings.generated.ts'
import { generateSandboxApi } from '@/services/generateSandboxApi.ts'
import { generateWithWorker } from './generate-worker.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'

type GenerateWithSandboxApiArgs = {
  projectName: string
  schemaContents: string
  clientSettings: ClientSettings | undefined
  accountName: string
  token: string | undefined
}

type GenerateWithWorkerArgs = {
  bundlePath: string
  schemaContents: string
  clientSettings: ClientSettings | undefined
}

// Class is used as a proxy for easy mocking in tests
export class GenerateArtifacts {
  static async generateWithWorker({
    bundlePath,
    schemaContents,
    clientSettings
  }: GenerateWithWorkerArgs): Promise<GenerateResponse> {
    return await generateWithWorker({
      schemaContents,
      clientSettings,
      bundlePath
    })
  }

  static async generateWithSandboxApi({
    projectName,
    schemaContents,
    clientSettings,
    accountName,
    token
  }: GenerateWithSandboxApiArgs): Promise<GenerateResponse> {
    return await generateSandboxApi({
      accountName: accountName,
      serverName: projectName,
      schema: schemaContents,
      clientSettings,
      token
    })
  }
}
