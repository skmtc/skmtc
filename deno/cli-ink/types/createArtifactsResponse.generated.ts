import { z } from 'zod'
import { manifestContent } from '@/types/manifestContent.generated.ts'

export const createArtifactsResponse = z.object({
  artifacts: z.record(z.string(), z.string()),
  manifest: manifestContent,
})
