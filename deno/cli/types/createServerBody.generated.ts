import { DenoFile } from '@/types/denoFile.generated.ts'

export type CreateServerBody = {
  stackName: string | null
  generatorIds?: Array<string> | undefined
  assets?: Record<string, DenoFile> | undefined
}
