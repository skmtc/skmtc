// @deno-types="npm:@types/lodash-es@4.17.12"
import { setWith } from 'npm:lodash-es@4.17.21'
import type { OpenAPIV3 } from 'openapi-types'
import { parse as parseYaml } from 'jsr:@std/yaml@0.215.0'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '../oas/document/Document.ts'
import type * as log from 'jsr:@std/log@^0.224.6'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'

type ConstructorArgs = {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  stackTrail: StackTrail
}

export type ParseReturn = {
  oasDocument: OasDocument
  extensions: Record<string, unknown>
}

type RegisterExtensionArgs = {
  type: string
  stackTrail: string[]
  extensionFields: Record<string, unknown>
}

export class ParseContext {
  documentObject: OpenAPIV3.Document
  logger: log.Logger
  oasDocument: OasDocument
  stackTrail: StackTrail
  extentions: Record<string, unknown>

  constructor({ documentObject, logger, stackTrail }: ConstructorArgs) {
    this.documentObject = documentObject
    this.logger = logger
    this.stackTrail = stackTrail
    this.extentions = {}
    this.oasDocument = new OasDocument()
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

  registerExtension({ extensionFields, stackTrail, type }: RegisterExtensionArgs): void {
    setWith(this.extentions, stackTrail.concat('__x__'), { type, extensionFields }, Object)
  }

  logSkippedFields(skipped: Record<string, unknown>) {
    Object.entries(skipped).forEach(([key, value]) => {
      this.trace(key, () => {
        const str = JSON.stringify(value)
        const reduced = str.length > 30 ? `${str.slice(0, 30)}...` : str

        this.logger.warn(`Property not yet implemented. value: ${reduced}`)
      })
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
