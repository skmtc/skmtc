import type { OpenAPIV3 } from 'openapi-types'
import { parse as parseYaml } from 'jsr:@std/yaml@0.215.0'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '../oas/document/Document.ts'
import type * as log from 'jsr:@std/log@^0.224.6'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import * as v from 'valibot'
import { merge, openApiMergeRules } from 'allof-merge'
import fs from 'node:fs'

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
}

export type ProvisionalParseArgs<T> = {
  key: string
  value: unknown
  parent: unknown
  schema: v.GenericSchema<T>
  toMessage: (value: unknown) => string
}

type ParseWarning = {
  message: string
  location: StackTrail
  parent: unknown
}

export class ParseContext {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  oasDocument: OasDocument
  stackTrail: StackTrail
  warnings: ParseWarning[]
  silent: boolean
  constructor({ documentObject, logger, stackTrail, silent = false }: ConstructorArgs) {
    const merged = merge(documentObject, {
      rules: openApiMergeRules('3.0.x'),
      mergeRefSibling: true,
      mergeCombinarySibling: true
    }) as OpenAPIV3.Document

    fs.writeFileSync('merged.json', JSON.stringify(merged, null, 2))

    this.documentObject = merged
    this.logger = logger
    this.stackTrail = stackTrail
    this.oasDocument = new OasDocument()
    this.silent = silent
    this.warnings = []
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

  logSkippedFields(skipped: Record<string, unknown>, parent: unknown) {
    Object.keys(skipped).forEach(key => {
      this.logWarning({
        key,
        parent,
        message: `Property not yet implemented`
      })
    })
  }

  provisionalParse<T>({
    key,
    value,
    parent,
    schema,
    toMessage
  }: ProvisionalParseArgs<T>): T | undefined {
    const parsed = v.safeParse(v.optional(schema), value)

    if (parsed.success) {
      return parsed.output
    }

    this.logWarning({
      key,
      parent,
      message: toMessage(value)
    })
  }

  logWarning({ key, parent, message }: LogWarningArgs) {
    this.trace(key, () => {
      this.warnings.push({
        message,
        location: this.stackTrail.clone(),
        parent
      })

      if (!this.silent) {
        this.logger.warn({
          location: this.stackTrail.toString(),
          parent: JSON.stringify(parent),
          message
        })
      }
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
