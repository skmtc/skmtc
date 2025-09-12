import { z } from 'zod'

export const server = z.object({
  id: z.string(),
  serverName: z.string(),
  latestDeploymentId: z.string().nullable(),
  latestDenoDeploymentId: z.string().nullable(),
  denoProjectName: z.string(),
  latestStatus: z.enum(['pending', 'success', 'failed', 'deleted']).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
