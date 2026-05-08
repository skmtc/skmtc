import * as v from 'valibot'
import { manifestContent } from '@skmtc/core/Manifest'

const gqlIssueType = v.picklist([
  'NESTED_LIST_LOSSY',
  'UNKNOWN_TYPE_KIND',
  'DROPPED_DIRECTIVE',
  'SKIPPED_FIELD_ARGUMENTS',
  'SKIPPED_FEATURE',
])

const gqlParseError = v.object({
  level: v.literal('error'),
  message: v.string(),
  location: v.string(),
  type: gqlIssueType,
})

const gqlParseWarning = v.object({
  level: v.literal('warning'),
  message: v.string(),
  location: v.string(),
  type: gqlIssueType,
})

const gqlParseIssue = v.union([gqlParseError, gqlParseWarning])

export const createArtifactsResponse = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent,
  // Parse issues are GraphQL-only today and the sandbox server hasn't
  // shipped them yet; default to `[]` so older server responses still
  // parse cleanly.
  parseIssues: v.optional(v.array(gqlParseIssue), []),
})
