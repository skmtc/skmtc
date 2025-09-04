import { z } from 'zod'

export const server = z.object({
  id: z.string(),
  stackName: z.string(),
  latestDeploymentId: z.string().nullable(),
  latestStatus: z.enum(['pending', 'success', 'failed', 'deleted']).nullable(),
  latestDenoDeploymentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
