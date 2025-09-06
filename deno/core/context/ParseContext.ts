import type { OpenAPIV3 } from 'openapi-types'
import { parse as parseYaml } from '@std/yaml/parse'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '../oas/document/Document.ts'
import type * as log from '@std/log'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import * as v from 'valibot'
import type { IssueType } from './types.ts'

/**
 * Constructor arguments for {@link ParseContext}.
 */
type ConstructorArgs = {
  /** The OpenAPI v3 document to parse */
  documentObject: OpenAPIV3.Document
  /** Logger instance for debug information */
  logger: log.Logger
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
type ParseWarningBase = {
  /** Issue severity level */
  level: 'warning'
  /** Warning message */
  message: string
}

/**
 * Base type for parse error messages.
 */
type ParseErrorBase = {
  /** Issue severity level */
  level: 'error'
  /** The error that occurred */
  error: Error
}

/**
 * Base union type for parse issues.
 */
type ParseIssueBase = ParseErrorBase | ParseWarningBase

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

/**
 * The parsing context for the first phase of the SKMTC transformation pipeline.
 * 
 * `ParseContext` is responsible for converting OpenAPI v3 JSON documents into
 * the internal OAS (OpenAPI Schema) object representation used by SKMTC. It
 * provides comprehensive error handling, validation, and issue tracking during
 * the parsing process.
 * 
 * This context handles the complex task of transforming external OpenAPI
 * specifications into type-safe internal representations while maintaining
 * detailed information about any parsing issues or inconsistencies found.
 * 
 * ## Key Features
 * 
 * - **JSON to OAS Conversion**: Transforms OpenAPI JSON into typed OAS objects
 * - **Validation & Error Handling**: Comprehensive validation with detailed error reporting
 * - **Issue Tracking**: Collects warnings and errors with precise location information
 * - **Reference Management**: Handles complex reference resolution and tracking
 * - **Logging Integration**: Provides detailed logging and tracing capabilities
 * - **Silent Mode**: Can suppress console output while maintaining error collection
 * 
 * @example Basic parsing usage
 * ```typescript
 * import { ParseContext } from '@skmtc/core';
 * 
 * const parseContext = new ParseContext({
 *   documentObject: openApiJsonDocument,
 *   logger: myLogger,
 *   stackTrail: traceStack,
 *   silent: false
 * });
 * 
 * const oasDocument = parseContext.parse();
 * 
 * // Check for parsing issues
 * if (parseContext.issues.length > 0) {
 *   console.log('Parsing issues found:');
 *   parseContext.issues.forEach(issue => {
 *     console.log(`${issue.level}: ${issue.location} - ${issue.message || issue.error?.message}`);
 *   });
 * }
 * 
 * // Use the parsed document
 * console.log('Parsed schemas:', Object.keys(oasDocument.components?.schemas || {}));
 * ```
 * 
 * @example Error handling during parsing
 * ```typescript
 * const parseContext = new ParseContext({
 *   documentObject: malformedOpenApiDoc,
 *   logger: logger,
 *   stackTrail: stack,
 *   silent: true
 * });
 * 
 * try {
 *   const parsed = parseContext.parse();
 *   
 *   // Separate errors from warnings
 *   const errors = parseContext.issues.filter(issue => issue.level === 'error');
 *   const warnings = parseContext.issues.filter(issue => issue.level === 'warning');
 *   
 *   if (errors.length > 0) {
 *     console.error(`${errors.length} parsing errors found`);
 *     errors.forEach(error => {
 *       console.error(`Error at ${error.location}: ${error.error.message}`);
 *     });
 *   }
 *   
 *   if (warnings.length > 0) {
 *     console.warn(`${warnings.length} parsing warnings found`);
 *     warnings.forEach(warning => {
 *       console.warn(`Warning at ${warning.location}: ${warning.message}`);
 *     });
 *   }
 * } catch (error) {
 *   console.error('Critical parsing failure:', error);
 * }
 * ```
 * 
 * @example Integration with CoreContext
 * ```typescript
 * // Typically used within CoreContext.parse()
 * class CustomCoreContext extends CoreContext {
 *   parseWithCustomValidation(document: OpenAPIV3.Document) {
 *     const parseContext = new ParseContext({
 *       documentObject: document,
 *       logger: this.logger,
 *       stackTrail: this.stackTrail,
 *       silent: this.silent
 *     });
 *     
 *     const parsed = parseContext.parse();
 *     
 *     // Custom post-processing based on issues
 *     const criticalErrors = parseContext.issues.filter(issue => 
 *       issue.level === 'error' && issue.type === 'schema-validation'
 *     );
 *     
 *     if (criticalErrors.length > 0) {
 *       throw new Error(`Schema validation failed: ${criticalErrors.length} critical errors`);
 *     }
 *     
 *     return parsed;
 *   }
 * }
 * ```
 */
export class ParseContext {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  oasDocument: OasDocument
  stackTrail: StackTrail
  issues: ParseIssue[]
  silent: boolean
  #refStackTrails: Record<string, StackTrail[]>
  #refErrors: Record<string, Error[]>
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

  parse(): OasDocument {
    this.oasDocument.fields = toDocumentFieldsV3({
      documentObject: this.documentObject,
      context: this
    })

    this.removeErroredItems()

    return this.oasDocument
  }

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

  registerRef(stackTrail: StackTrail, $ref: string) {
    const refStackTrails = this.#refStackTrails[$ref]

    refStackTrails ? refStackTrails.push(stackTrail) : (this.#refStackTrails[$ref] = [stackTrail])
  }

  registerRefError(error: Error, $ref: string | undefined) {
    if ($ref) {
      const refErrors = this.#refErrors[$ref]

      refErrors ? refErrors.push(error) : (this.#refErrors[$ref] = [error])
    }
  }

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.stackTrail, token, fn, this.logger)
  }

  logSkippedFields({ skipped, parent, parentType }: LogSkippedValuesArgs) {
    Object.keys(skipped).forEach(key => {
      this.logIssue({
        key,
        parent,
        level: 'warning',
        message: `Unexpected property '${key}' in '${parentType}'`,
        type: 'UNEXPECTED_PROPERTY'
      })
    })
  }

  provisionalParse<T>({
    key,
    value,
    parent,
    schema,
    toMessage,
    type
  }: ProvisionalParseArgs<T>): T | undefined {
    const parsed = v.safeParse(v.optional(schema), value)

    if (parsed.success) {
      return parsed.output
    }

    this.logIssue({
      key,
      parent,
      level: 'warning',
      message: toMessage(value),
      type
    })
  }

  logIssue({ key, parent, type, ...issue }: LogIssueArgs) {
    this.trace(key, () => this.logIssueNoKey({ parent, type, ...issue }))
  }

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

export const parseSchema = (schema: string): OpenAPIV3.Document => {
  if (schema.trimStart().startsWith('{')) {
    return JSON.parse(schema) as OpenAPIV3.Document
  } else {
    return parseYaml(schema) as OpenAPIV3.Document
  }
}
