import { z } from 'zod'
import { openApiVersion } from '@/types/openApiVersion.generated.ts'
import { schemaFormat } from '@/types/schemaFormat.generated.ts'

export const schema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  openapiVersion: openApiVersion,
  typespecSchemaId: z.string().nullable(),
  public: z.boolean(),
  format: schemaFormat,
  iconKey: z.string().nullable().optional(),
  sourceUrl: z.string().nullable(),
  createdAt: z.string(),
})
