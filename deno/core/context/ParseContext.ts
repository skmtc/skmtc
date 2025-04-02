import type { OpenAPIV3 } from 'openapi-types'
import { parse as parseYaml } from 'jsr:@std/yaml@0.215.0'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '../oas/document/Document.ts'
import type * as log from 'jsr:@std/log@^0.224.6'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import * as v from 'valibot'
type ConstructorArgs = {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  stackTrail: StackTrail
}

export type ParseReturn = {
  oasDocument: OasDocument
}

export type LogWarningArgs = {
  key: string
  message: string
}

export type ProvisionalParseArgs<T> = {
  key?: string
  value: unknown
  schema: v.GenericSchema<T>
  toMessage: (value: unknown) => string
}

export class ParseContext {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  oasDocument: OasDocument
  stackTrail: StackTrail

  constructor({ documentObject, logger, stackTrail }: ConstructorArgs) {
    this.documentObject = documentObject
    this.logger = logger
    this.stackTrail = stackTrail
    this.oasDocument = new OasDocument()
  }

  parse() {
    try {
      this.oasDocument.fields = toDocumentFieldsV3({
        documentObject: this.documentObject,
        context: this
      })
    } catch (e) {
      console.log('ERROR', e)
      console.log('STACK', this.stackTrail.toString())
    }

    return this.oasDocument
  }

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.stackTrail, token, fn)
  }

  logSkippedFields(skipped: Record<string, unknown>) {
    Object.keys(skipped).forEach(key => {
      this.logWarning({
        key,
        message: `Property not yet implemented`
      })
    })
  }

  provisionalParse<T>({
    key = 'example',
    value,
    schema,
    toMessage
  }: ProvisionalParseArgs<T>): T | undefined {
    const parsed = v.safeParse(v.optional(schema), value)

    if (parsed.success) {
      return parsed.output
    }

    this.logWarning({
      key,
      message: toMessage(value)
    })
  }

  logWarning({ key, message }: LogWarningArgs) {
    this.trace(key, () => {
      this.logger.warn({ location: this.stackTrail.toString(), message })
    })
  }
}

export const parseSchema = (schema: string) => {
  if (schema.trimStart().startsWith('{')) {
    return JSON.parse(schema) as OpenAPIV3.Document
  } else {
    return parseYaml(schema) as OpenAPIV3.Document
  }
}
