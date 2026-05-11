import * as v from 'valibot'
import { manifestContent } from '@skmtc/core/Manifest'

// NOTE: `.generated.ts` files are normally regenerated from server
// schemas. This file was last regenerated while parseIssues lived as a
// sibling field; since they now nest inside the manifest, the response
// shape is simpler. When the sandbox server starts emitting `parseIssues`
// inside its manifest payload, this file can be regenerated cleanly.
export const createArtifactsResponse = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})
