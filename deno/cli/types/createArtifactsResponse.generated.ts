import { z } from 'zod'
import { manifestContent } from '@/types/manifestContent.generated.ts'

const gqlParseIssue = z.object({
  level: z.enum(['error', 'warning']),
  message: z.string(),
  location: z.string(),
  type: z.string()
})

export const createArtifactsResponse = z.object({
  artifacts: z.record(z.string(), z.string()),
  manifest: manifestContent,
  // Parse issues are GraphQL-only today and the sandbox server hasn't
  // shipped them yet; default to `[]` so older server responses still
  // parse cleanly.
  parseIssues: z.array(gqlParseIssue).default([])
})
