import { z } from 'zod'
import { ManifestContent, manifestContent } from '@skmtc/core/Manifest'

export type CreateArtifactsResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}

export const createArtifactsResponse: z.ZodType<CreateArtifactsResponse> = z.object({
  artifacts: z.record(z.string()),
  manifest: manifestContent
})
