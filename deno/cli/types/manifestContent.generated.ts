import { z } from 'zod'
import { manifestEntry } from '@/types/manifestEntry.generated.ts'
import { preview } from '@/types/preview.generated.ts'
import { mapping } from '@/types/mapping.generated.ts'
import { resultType } from '@/types/resultType.generated.ts'

export const manifestContent = z.object({
  deploymentId: z.string(),
  traceId: z.string(),
  spanId: z.string(),
  region: z.string().optional(),
  files: z.record(z.string(), manifestEntry),
  previews: z.record(z.string(), z.record(z.string(), preview)),
  mappings: z.record(z.string(), z.record(z.string(), mapping)),
  results: z.record(
    z.string(),
    z.union([
      resultType,
      z.record(z.string(), resultType),
      z.array(z.record(z.string(), resultType).nullable()),
    ]),
  ),
  startAt: z.number().int(),
  endAt: z.number().int(),
})
