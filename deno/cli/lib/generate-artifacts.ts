import type { ClientSettings } from '@skmtc/core/Settings'
import type { SerializableAttribution } from '@skmtc/worker/types'
import { generateWithWorker } from './generate-worker.ts'
import { generateWithServer } from './generate-server.ts'
import type { GenerateResponse } from '@/types/generateResponse.ts'
import type { FileType } from '@/lib/types.ts'

type GenerateWithWorkerArgs = {
  bundlePath: string
  schemaContents: string
  fileType: FileType
  clientSettings: ClientSettings | undefined
  attribution?: SerializableAttribution
  /**
   * When set, generate against a DEPLOYED stack server's `/artifacts` endpoint
   * (over HTTP) instead of loading the local `bundle.js`. The response has the
   * identical {@link GenerateResponse} shape, so callers write it the same way.
   */
  stackUrl?: string
}

// Class is used as a proxy for easy mocking in tests
export class GenerateArtifacts {
  static async generateWithWorker({
    bundlePath,
    schemaContents,
    fileType,
    clientSettings,
    attribution,
    stackUrl
  }: GenerateWithWorkerArgs): Promise<GenerateResponse> {
    if (stackUrl) {
      return await generateWithServer({ stackUrl, schemaContents, fileType, clientSettings })
    }
    return await generateWithWorker({
      schemaContents,
      fileType,
      clientSettings,
      bundlePath,
      attribution
    })
  }
}
