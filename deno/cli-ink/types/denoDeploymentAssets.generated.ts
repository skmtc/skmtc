import { DenoFile } from '@/types/denoFile.generated.ts'

export type DenoDeploymentAssets = {
  generatorIds: Array<string>
  assets: Record<string, DenoFile>
}
