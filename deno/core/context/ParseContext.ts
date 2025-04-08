import type { OpenAPIV3 } from 'openapi-types'
import { parse as parseYaml } from 'jsr:@std/yaml@0.215.0'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '../oas/document/Document.ts'
import type * as log from 'jsr:@std/log@^0.224.6'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import * as v from 'valibot'
import type { WarningType } from './types.ts'
type ConstructorArgs = {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  stackTrail: StackTrail
  silent?: boolean
}

export type ParseReturn = {
  oasDocument: OasDocument
  warnings: ParseWarning[]
}

export type LogWarningArgs = {
  key: string
  parent: unknown
  message: string
  type: WarningType
}

export type LogWarningNoKeyArgs = {
  parent: unknown
  message: string
  type: WarningType
}

export type ProvisionalParseArgs<T> = {
  key: string
  value: unknown
  parent: unknown
  schema: v.GenericSchema<T>
  toMessage: (value: unknown) => string
  type: WarningType
}

export type LogSkippedValuesArgs = {
  skipped: Record<string, unknown>
  parent: unknown
  parentType: string
}

type ParseWarning = {
  message: string
  location: StackTrail
  parent: unknown
  type: WarningType
}

export class ParseContext {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  oasDocument: OasDocument
  stackTrail: StackTrail
  warnings: ParseWarning[]
  silent: boolean
  constructor({ documentObject, logger, stackTrail, silent = false }: ConstructorArgs) {
    this.documentObject = documentObject
    this.logger = logger
    this.stackTrail = stackTrail
    this.oasDocument = new OasDocument()
    this.silent = silent
    this.warnings = []
  }

  parse() {
    this.oasDocument.fields = toDocumentFieldsV3({
      documentObject: this.documentObject,
      context: this
    })

    return this.oasDocument
  }

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.stackTrail, token, fn)
  }

  logSkippedFields({ skipped, parent, parentType }: LogSkippedValuesArgs) {
    Object.keys(skipped).forEach(key => {
      this.logWarning({
        key,
        parent,
        message: `Unexpected property "${key}" in "${parentType}"`,
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

    this.logWarning({
      key,
      parent,
      message: toMessage(value),
      type
    })
  }

  logWarning({ key, parent, message, type }: LogWarningArgs) {
    this.trace(key, () => this.logWarningNoKey({ parent, message, type }))
  }

  logWarningNoKey({ parent, message, type }: LogWarningNoKeyArgs) {
    this.warnings.push({
      message,
      location: this.stackTrail.clone(),
      parent,
      type
    })

    if (!this.silent) {
      this.logger.warn({
        location: this.stackTrail.toString(),
        parent: JSON.stringify(parent),
        message,
        type
      })
    }
  }
}

export const parseSchema = (schema: string) => {
  if (schema.trimStart().startsWith('{')) {
    return JSON.parse(schema) as OpenAPIV3.Document
  } else {
    return parseYaml(schema) as OpenAPIV3.Document
  }
}
