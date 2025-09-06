import type { OpenAPIV3 } from 'openapi-types'
import { parse as parseYaml } from '@std/yaml/parse'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '../oas/document/Document.ts'
import type * as log from '@std/log'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import * as v from 'valibot'
import type { IssueType } from './types.ts'

type ConstructorArgs = {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  stackTrail: StackTrail
  silent: boolean
}

export type ParseReturn = {
  oasDocument: OasDocument
  issues: ParseIssue[]
}

type ParseWarningBase = {
  level: 'warning'
  message: string
}

type ParseErrorBase = {
  level: 'error'
  error: Error
}

type ParseIssueBase = ParseErrorBase | ParseWarningBase

export type LogIssueArgs = ParseIssueBase & {
  key: string
  parent: unknown
  type: IssueType
}

export type LogIssueNoKeyArgs = ParseIssueBase & {
  parent: unknown
  type: IssueType
}

export type ProvisionalParseArgs<T> = {
  key: string
  value: unknown
  parent: unknown
  schema: v.GenericSchema<T>
  toMessage: (value: unknown) => string
  type: IssueType
}

export type LogSkippedValuesArgs = {
  skipped: Record<string, unknown>
  parent: unknown
  parentType: string
}

export type ParseError = {
  level: 'error'
  error: Error
  location: string
  parent: unknown
  type: IssueType
}

export type ParseWarning = {
  level: 'warning'
  message: string
  location: string
  parent: unknown
  type: IssueType
}

export type ParseIssue = ParseError | ParseWarning

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
