import { z } from 'zod'

export const workspace = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  serverId: z.string(),
  openapiSchemaId: z.string(),
  deploymentId: z.string(),
  createdAt: z.string(),
})
