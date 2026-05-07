import { z } from 'zod'
import { manifestContent } from '@/types/manifestContent.generated.ts'

const gqlIssueType = z.enum([
  'NESTED_LIST_LOSSY',
  'UNKNOWN_TYPE_KIND',
  'DROPPED_DIRECTIVE',
  'SKIPPED_FIELD_ARGUMENTS',
  'SKIPPED_FEATURE',
])

const gqlParseError = z.object({
  level: z.literal('error'),
  message: z.string(),
  location: z.string(),
  type: gqlIssueType,
})

const gqlParseWarning = z.object({
  level: z.literal('warning'),
  message: z.string(),
  location: z.string(),
  type: gqlIssueType,
})

const gqlParseIssue = z.union([gqlParseError, gqlParseWarning])

export const createArtifactsResponse = z.object({
  artifacts: z.record(z.string(), z.string()),
  manifest: manifestContent,
  // Parse issues are GraphQL-only today and the sandbox server hasn't
  // shipped them yet; default to `[]` so older server responses still
  // parse cleanly.
  parseIssues: z.array(gqlParseIssue).default([])
})
