import { z } from 'zod'
import { schema } from '@/types/schema.generated.ts'
import { server } from '@/types/server.generated.ts'
import { clientSettings } from '@/types/clientSettings.generated.ts'

export const workspaceDetails = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  baseFilesSha256: z.string().nullable(),
  schema: schema,
  server: server,
  schemaContent: z.string().optional(),
  clientSettings: clientSettings,
  createdAt: z.string(),
})
