import { ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import * as v from 'valibot'

export type CreateArtifactsResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}

export const createArtifactsResponse: v.GenericSchema<CreateArtifactsResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})
