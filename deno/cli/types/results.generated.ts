import { resultType } from '@/types/resultType.generated.ts'
import { z } from 'zod'

export const results = z.object({
  parse: z
    .record(
      z.string(),
      z.union([
        resultType,
        z.record(z.string(), resultType),
        z.record(z.string(), z.record(z.string(), resultType)),
        z.record(
          z.string(),
          z.record(z.string(), z.record(z.string(), resultType)),
        ),
      ]),
    )
    .optional(),
  generate: z
    .record(
      z.string(),
      z.union([
        resultType,
        z.record(z.string(), resultType),
        z.record(z.string(), z.record(z.string(), resultType)),
        z.record(
          z.string(),
          z.record(z.string(), z.record(z.string(), resultType)),
        ),
      ]),
    )
    .optional(),
  render: z.record(z.string(), resultType).optional(),
})
