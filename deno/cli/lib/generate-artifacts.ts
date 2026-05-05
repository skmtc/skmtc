import type { ClientSettings } from '@/types/clientSettings.generated.ts'
import { generateSandboxApi } from '@/services/generateSandboxApi.ts'
import { generateWithWorker } from './generate-worker.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'
import { fileTypeToProtocol, type FileType } from '@/lib/types.ts'

type GenerateWithSandboxApiArgs = {
  projectName: string
  schemaContents: string
  fileType: FileType
  clientSettings: ClientSettings | undefined
  accountName: string
  token: string | undefined
}

type GenerateWithWorkerArgs = {
  bundlePath: string
  schemaContents: string
  fileType: FileType
  clientSettings: ClientSettings | undefined
}

// Class is used as a proxy for easy mocking in tests
export class GenerateArtifacts {
  static async generateWithWorker({
    bundlePath,
    schemaContents,
    fileType,
    clientSettings
  }: GenerateWithWorkerArgs): Promise<GenerateResponse> {
    return await generateWithWorker({
      schemaContents,
      fileType,
      clientSettings,
      bundlePath
    })
  }

  static async generateWithSandboxApi({
    projectName,
    schemaContents,
    fileType,
    clientSettings,
    accountName,
    token
  }: GenerateWithSandboxApiArgs): Promise<GenerateResponse> {
    return await generateSandboxApi({
      accountName: accountName,
      serverName: projectName,
      schema: schemaContents,
      protocol: fileTypeToProtocol(fileType),
      clientSettings,
      token
    })
  }
}
