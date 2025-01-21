// @deno-types="npm:@types/lodash-es@4.17.12"
import { setWith } from 'npm:lodash-es@4.17.21'
import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import * as Sentry from 'npm:@sentry/deno@8.47.0'
import { parse as parseYaml } from 'jsr:@std/yaml@0.215.0'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.ts'
import { OasDocument } from '../oas/document/Document.ts'
import type * as log from 'jsr:@std/log@^0.224.6'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import { Converter, type ConverterOptions } from 'npm:@apiture/openapi-down-convert@0.14.0'

type ConstructorArgs = {
  schema: string
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
  schema: string
  logger: log.Logger
  oasDocument: OasDocument
  stackTrail: StackTrail
  extentions: Record<string, unknown>

  constructor({ schema, logger, stackTrail }: ConstructorArgs) {
    this.schema = schema
    this.logger = logger
    this.stackTrail = stackTrail
    this.extentions = {}
    this.oasDocument = new OasDocument()
  }

  parse() {
    const documentObject = this.#parseSchema()

    if (documentObject?.openapi?.startsWith('3.1')) {
      const options: ConverterOptions = {
        verbose: false,
        deleteExampleWithId: false,
        allOfTransform: true
      }

      const converter = new Converter(documentObject, options)

      const oas30Document = converter.convert() as OpenAPIV3.Document

      return this.#parseDocument(oas30Document)
    }

    return this.#parseDocument(documentObject)
  }

  #parseSchema(): OpenAPIV3.Document {
    const documentObject: OpenAPIV3.Document = Sentry.startSpan(
      { name: 'Parse string schema to object' },
      () => parseSchema(this.schema)
    )

    return documentObject
  }

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.stackTrail, token, fn)
  }

  #parseDocument(documentObject: OpenAPIV3.Document): OasDocument {
    if (!documentObject.openapi.startsWith('3.0.')) {
      throw new Error('Only OpenAPI v3 is supported')
    }

    this.oasDocument.fields = toDocumentFieldsV3({
      documentObject,
      context: this
    })

    return this.oasDocument
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
