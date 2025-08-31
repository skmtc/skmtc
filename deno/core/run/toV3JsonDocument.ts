import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'npm:openapi-types@^12.1.3'
import { parse as parseYaml } from '@std/yaml/parse'
import {
  Converter as ThreeOneToThreeZeroConverter,
  type ConverterOptions
} from 'npm:@apiture/openapi-down-convert@^0.14.0'
import { match, P } from 'ts-pattern'
// @deno-types="npm:@types/swagger2openapi@7.0.4"
import converter from 'npm:swagger2openapi@^7.0.8'

type AnyOasDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document

export const stringToSchema = (schema: string): AnyOasDocument => {
  if (schema.trimStart().startsWith('{')) {
    return JSON.parse(schema) as AnyOasDocument
  } else {
    return parseYaml(schema) as AnyOasDocument
  }
}

export const toV3Document = async (schema: AnyOasDocument): Promise<OpenAPIV3.Document> => {
  return await match(schema)
    .with({ openapi: P.string.startsWith('3.0') }, doc => doc as OpenAPIV3.Document)
    .with({ openapi: P.string.startsWith('3.1') }, doc => {
      const options: ConverterOptions = {
        verbose: false,
        deleteExampleWithId: false,
        allOfTransform: true
      }

      const converter = new ThreeOneToThreeZeroConverter(doc, options)

      return converter.convert() as OpenAPIV3.Document
    })
    .with({ swagger: P.string.startsWith('2.0') }, async (doc: OpenAPIV2.Document) => {
      const parsed = await converter.convertObj(doc, {})

      return parsed.openapi
    })
    .otherwise(() => {
      console.log(
        'Unrecognized OpenAPI version',
        JSON.stringify(schema, null, 2).substring(0, 1000)
      )
      throw new Error('Unrecognized OpenAPI version')
    })
}
