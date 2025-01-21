
import { setWith } from 'lodash-es'
import type { OpenAPIV3 } from 'openapi-types'
import * as Sentry from '@sentry/deno'
import { parse as parseYaml } from '../deps/jsr.io/@std/yaml/0.215.0/mod.js'
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.js'
import { OasDocument } from '../oas/document/Document.js'
import type * as log from '../deps/jsr.io/@std/log/0.224.8/mod.js'
import type { StackTrail } from './StackTrail.js'
import { tracer } from '../helpers/tracer.js'
import { Converter, type ConverterOptions } from '@apiture/openapi-down-convert'

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
