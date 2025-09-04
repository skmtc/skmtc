import { z } from 'zod'
import { denoFile } from '@/types/denoFile.generated.ts'
import { deploymentStatus } from '@/types/deploymentStatus.generated.ts'

export const deploymentInfo = z.object({
  id: z.string(),
  assets: z.record(z.string(), denoFile),
  status: deploymentStatus,
  projectId: z.string(),
  createdAt: z.string(),
})
