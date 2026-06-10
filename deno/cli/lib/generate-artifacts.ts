import type { ClientSettings } from '@skmtc/core/Settings'
import type { SerializableAttribution } from '@skmtc/worker/types'
import { generateWithWorker } from './generate-worker.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'
import type { FileType } from '@/lib/types.ts'

type GenerateWithWorkerArgs = {
  bundlePath: string
  schemaContents: string
  fileType: FileType
  clientSettings: ClientSettings | undefined
  attribution?: SerializableAttribution
}

// Class is used as a proxy for easy mocking in tests
export class GenerateArtifacts {
  static async generateWithWorker({
    bundlePath,
    schemaContents,
    fileType,
    clientSettings,
    attribution
  }: GenerateWithWorkerArgs): Promise<GenerateResponse> {
    return await generateWithWorker({
      schemaContents,
      fileType,
      clientSettings,
      bundlePath,
      attribution
    })
  }
}
