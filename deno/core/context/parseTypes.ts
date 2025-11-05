import type { OasDocument } from '@/oas/document/Document.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import type { IssueType } from '@/context/generateTypes.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Base type for parse error messages.
 */
export type ParseErrorBase = {
  /** Issue severity level */
  level: 'error'
  /** The error that occurred */
  error: Error
}

/**
 * Arguments for logging issues without a specific key.
 */
export type LogIssueNoKeyArgs = ParseIssueBase & {
  /** The parent object containing the issue */
  parent: unknown
  /** The type of issue for categorization */
  type: IssueType
  /** Stack trail for tracking current parsing context */
  stackTrail: StackTrail
}

/**
 * Base type for parse warning messages.
 */
export type ParseWarningBase = {
  /** Issue severity level */
  level: 'warning'
  /** Warning message */
  message: string
}

/**
 * Base union type for parse issues.
 */
export type ParseIssueBase = ParseErrorBase | ParseWarningBase

/**
 * Arguments for logging issues with a specific key.
 */
export type LogIssueArgs = ParseIssueBase & {
  /** Stack trail for tracking current parsing context */
  stackTrail: StackTrail
  /** The key where the issue occurred */
  key: string
  /** The parent object containing the issue */
  parent: unknown
  /** The type of issue for categorization */
  type: IssueType
}

/**
 * Arguments for logging skipped values during parsing.
 */
export type LogSkippedValuesArgs = {
  /** Stack trail for tracking current parsing context */
  stackTrail: StackTrail
  /** Record of skipped key-value pairs */
  skipped: Record<string, unknown>
  /** The parent object context */
  parent: unknown
  /** String description of the parent type */
  parentType: string
}

export type ParseContextType = {
  oasDocument: OasDocument
  documentObject: OpenAPIV3.Document
  parse: (stackTrail: StackTrail) => OasDocument
  removeErroredItems: () => void
  registerRef: (stackTrail: StackTrail, $ref: string) => void
  registerRefError: (error: Error, $ref: string | undefined) => void
  logSkippedFields: (args: LogSkippedValuesArgs) => void
  logIssue: (args: LogIssueArgs) => void
  logIssueNoKey: (args: LogIssueNoKeyArgs) => void
}
