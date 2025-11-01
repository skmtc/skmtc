import type { OpenAPIV3 } from 'openapi-types'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '../oas/document/Document.ts'
import type { Logger } from '../types/Logger.ts'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import type { IssueType } from './types.ts'
import type * as v from 'valibot'

/**
 * Constructor arguments for {@link ParseContext}.
 */
type ConstructorArgs = {
  /** The OpenAPI v3 document to parse */
  documentObject: OpenAPIV3.Document
  /** Logger instance for debug information */
  logger: Logger
  /** Stack trail for distributed tracing */
  stackTrail: StackTrail
  /** Whether to suppress console output */
  silent: boolean
}

/**
 * Return type for the parse operation.
 */
export type ParseReturn = {
  /** The parsed OAS document */
  oasDocument: OasDocument
  /** Array of parsing issues encountered */
  issues: ParseIssue[]
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
 * Base type for parse error messages.
 */
export type ParseErrorBase = {
  /** Issue severity level */
  level: 'error'
  /** The error that occurred */
  error: Error
}

/**
 * Base union type for parse issues.
 */
export type ParseIssueBase = ParseErrorBase | ParseWarningBase

/**
 * Arguments for logging issues with a specific key.
 */
export type LogIssueArgs = ParseIssueBase & {
  /** The key where the issue occurred */
  key: string
  /** The parent object containing the issue */
  parent: unknown
  /** The type of issue for categorization */
  type: IssueType
}

/**
 * Arguments for logging issues without a specific key.
 */
export type LogIssueNoKeyArgs = ParseIssueBase & {
  /** The parent object containing the issue */
  parent: unknown
  /** The type of issue for categorization */
  type: IssueType
}

/**
 * Arguments for provisional parsing with validation.
 */
export type ProvisionalParseArgs<T> = {
  /** The key being parsed */
  key: string
  /** The value to validate */
  value: unknown
  /** The parent object context */
  parent: unknown
  /** Valibot schema for validation */
  schema: v.GenericSchema<T>
  /** Function to generate error messages */
  toMessage: (value: unknown) => string
  /** The type of issue for categorization */
  type: IssueType
}

/**
 * Arguments for logging skipped values during parsing.
 */
export type LogSkippedValuesArgs = {
  /** Record of skipped key-value pairs */
  skipped: Record<string, unknown>
  /** The parent object context */
  parent: unknown
  /** String description of the parent type */
  parentType: string
}

/**
 * Represents a parsing error with location context.
 */
export type ParseError = {
  /** Error severity level */
  level: 'error'
  /** The error that occurred */
  error: Error
  /** Location string where the error occurred */
  location: string
  /** The parent object context */
  parent: unknown
  /** The type of issue for categorization */
  type: IssueType
}

/**
 * Represents a parsing warning with location context.
 */
export type ParseWarning = {
  /** Warning severity level */
  level: 'warning'
  /** Warning message */
  message: string
  /** Location string where the warning occurred */
  location: string
  /** The parent object context */
  parent: unknown
  /** The type of issue for categorization */
  type: IssueType
}

/**
 * Union type for all parsing issues.
 */
export type ParseIssue = ParseError | ParseWarning

export class ParseContext {
  /** The original OpenAPI v3 document being parsed */
  documentObject: OpenAPIV3.Document
  /** Logger instance for tracking parse progress and issues */
  logger: Logger
  /** The parsed OAS document result */
  oasDocument: OasDocument
  /** Stack trail for tracking current parsing context */
  stackTrail: StackTrail
  /** Collection of parsing issues encountered during processing */
  issues: ParseIssue[]
  /** Whether to suppress console output during parsing */
  silent: boolean
  #refStackTrails: Record<string, StackTrail[]>
  #refErrors: Record<string, Error[]>
  /**
   * Creates a new ParseContext instance for the parsing phase.
   *
   * @param args - Constructor arguments including document object, logger, and options
   */
  constructor({ documentObject, logger, stackTrail, silent = true }: ConstructorArgs) {
    this.documentObject = documentObject
    this.logger = logger
    this.stackTrail = stackTrail
    this.oasDocument = new OasDocument()
    this.silent = silent
    this.issues = []
    this.#refStackTrails = {}
    this.#refErrors = {}
  }

  /**
   * Parses the OpenAPI v3 document and returns the internal OAS document representation.
   *
   * @returns Parsed OAS document with all components and operations
   */
  parse(): OasDocument {
    this.oasDocument.fields = toDocumentFieldsV3({
      documentObject: this.documentObject,
      context: this
    })

    this.removeErroredItems()

    return this.oasDocument
  }

  /**
   * Removes items from the parsed document that encountered errors during parsing.
   */
  removeErroredItems() {
    Object.entries(this.#refErrors).forEach(([$ref, errors]) => {
      errors.forEach(error => {
        this.#refStackTrails[$ref]?.forEach(stackTrail => {
          const removed = this.oasDocument.removeItem(stackTrail)

          if (removed) {
            this.issues.push({
              level: 'error',
              error,
              location: stackTrail.toString(),
              parent: removed,
              type: 'INVALID_DEPENDENCY_REF'
            })
          }
        })
      })
    })
  }

  /**
   * Registers a reference ($ref) with its associated stack trail for error tracking.
   *
   * @param stackTrail - Current processing context stack trail
   * @param $ref - OpenAPI reference string to register
   */
  registerRef(stackTrail: StackTrail, $ref: string) {
    const refStackTrails = this.#refStackTrails[$ref]

    refStackTrails ? refStackTrails.push(stackTrail) : (this.#refStackTrails[$ref] = [stackTrail])
  }

  /**
   * Registers an error that occurred while processing a reference.
   *
   * @param error - Error that occurred during reference processing
   * @param $ref - Reference string that caused the error (if available)
   */
  registerRefError(error: Error, $ref: string | undefined) {
    if ($ref) {
      const refErrors = this.#refErrors[$ref]

      refErrors ? refErrors.push(error) : (this.#refErrors[$ref] = [error])
    }
  }

  /**
   * Logs warnings for fields that were skipped during parsing.
   *
   * @param args - Arguments containing skipped fields and parent context
   */
  logSkippedFields({ skipped, parent, parentType }: LogSkippedValuesArgs) {
    Object.keys(skipped).forEach(key => {
      console.log('SKIPPED FIELD', key)

      this.logIssue({
        key,
        parent,
        level: 'warning',
        message: `Unexpected property '${key}' in '${parentType}'`,
        type: 'UNEXPECTED_PROPERTY'
      })
    })
  }

  // /**
  //  * Executes a function within a traced context for debugging and monitoring.
  //  *
  //  * @param token - Trace identifier or path segments
  //  * @param fn - Function to execute within the trace context
  //  * @returns The result of the traced function execution
  //  */
  // trace<T>(token: string, fn: () => T): T {
  //   return tracer(this.stackTrail, token, fn, this.logger)
  // }

  /**
   * Logs a parsing issue with associated key context.
   *
   * @param args - Issue arguments including key, parent object, and issue details
   */
  logIssue({ key, parent, type, ...issue }: LogIssueArgs) {
    tracer(this.stackTrail, key, () => this.logIssueNoKey({ parent, type, ...issue }))
  }

  /**
   * Logs a parsing issue without specific key context.
   *
   * @param args - Issue arguments including parent object and issue details
   */
  logIssueNoKey({ parent, type, ...issue }: LogIssueNoKeyArgs) {
    if (issue.level === 'error') {
      this.registerRefError(issue.error, this.stackTrail.toStackRef())
    }

    this.issues.push({
      ...issue,
      location: this.stackTrail.toString(),
      parent,
      type
    })

    if (!this.silent) {
      this.logger.warn({
        ...issue,
        location: this.stackTrail.toString(),
        parent: JSON.stringify(parent),
        type
      })
    }
  }
}
