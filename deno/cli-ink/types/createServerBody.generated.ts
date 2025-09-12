import { DenoFile } from '@/types/denoFile.generated.ts'

export type CreateServerBody = {
  serverName: string
  generatorIds?: Array<string> | undefined
  assets?: Record<string, DenoFile> | undefined
}
