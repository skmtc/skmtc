import { z } from 'zod'

export const deployment = z.object({
  id: z.string(),
  isCanonical: z.boolean(),
  serverId: z.string(),
  denoDeploymentId: z.string().nullable(),
  deploymentStatus: z
    .enum(['pending', 'success', 'failed', 'deleted'])
    .nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
