/**
 * @fileoverview OpenAPI Document Conversion Utilities
 *
 * This module provides robust utilities for converting OpenAPI documents between
 * different versions (v2/Swagger, v3.0, v3.1) and formats (JSON, YAML). It handles
 * the complexities of version migration, format detection, and schema validation
 * to ensure seamless OpenAPI document processing within the SKMTC pipeline.
 *
 * ## Key Features
 *
 * - **Multi-Version Support**: Convert between Swagger v2, OpenAPI v3.0, and v3.1
 * - **Format Detection**: Automatic detection of JSON vs YAML input formats
 * - **Version Migration**: Safe migration with schema validation and error handling
 * - **Type Safety**: Full TypeScript support with proper type guards
 * - **Error Recovery**: Comprehensive error handling for malformed documents
 *
 * @example Converting Swagger v2 to OpenAPI v3
 * ```typescript
 * import { toV3Document } from '@skmtc/convert';
 *
 * const swaggerV2 = {
 *   swagger: '2.0',
 *   info: { title: 'My API', version: '1.0.0' },
 *   paths: { '/users': { get: { responses: { '200': { description: 'Success' } } } } }
 * };
 *
 * const openApiV3 = await toV3Document(swaggerV2);
 * console.log(openApiV3.openapi); // '3.0.0'
 * ```
 *
 * @example Converting from YAML string
 * ```typescript
 * const yamlContent = `
 * openapi: 3.1.0
 * info:
 *   title: My API
 *   version: 1.0.0
 * paths: {}
 * `;
 *
 * const openApiV3 = await toV3Document(yamlContent);
 * ```
 *
 * @example Handling conversion errors
 * ```typescript
 * try {
 *   const result = await toV3Document(malformedDocument);
 * } catch (error) {
 *   console.error('Conversion failed:', error.message);
 * }
 * ```
 *
 * @module toV3Document
 */

import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { parse as parseYaml } from '@std/yaml/parse'
import {
  Converter as ThreeOneToThreeZeroConverter,
  type ConverterOptions
} from '@skmtc/openapi-down-convert'
import type { AnyOasDocument } from './types.ts'

/**
 * Parses a string into an OpenAPI document object.
 *
 * Automatically detects whether the input string is JSON or YAML format based on
 * the content, then parses it into an OpenAPI document object. Supports all
 * OpenAPI versions (2.0, 3.0.x, 3.1.x).
 *
 * @param schema - The OpenAPI document as a JSON or YAML string
 * @returns Parsed OpenAPI document object
 *
 * @example Parsing JSON OpenAPI document
 * ```typescript
 * const jsonSchema = `{
 *   "openapi": "3.0.0",
 *   "info": { "title": "My API", "version": "1.0.0" },
 *   "paths": {}
 * }`;
 * const document = stringToSchema(jsonSchema);
 * console.log(document.info.title); // "My API"
 * ```
 *
 * @example Parsing YAML OpenAPI document
 * ```typescript
 * const yamlSchema = `
 * openapi: 3.0.0
 * info:
 *   title: My API
 *   version: 1.0.0
 * paths: {}
 * `;
 * const document = stringToSchema(yamlSchema);
 * console.log(document.info.title); // "My API"
 * ```
 *
 * @throws {SyntaxError} If the JSON is malformed
 * @throws {Error} If the YAML is malformed
 */
export const stringToSchema = (schema: string): AnyOasDocument => {
  if (schema.trimStart().startsWith('{')) {
    return JSON.parse(schema) as AnyOasDocument
  } else {
    return parseYaml(schema) as AnyOasDocument
  }
}

/**
 * Converts any OpenAPI document version to OpenAPI 3.0 format.
 *
 * SKMTC processes all documents using OpenAPI 3.0 as the internal format.
 * This function handles version detection and conversion from:
 * - OpenAPI 3.0.x (returned as-is)
 * - OpenAPI 3.1.x (downgraded to 3.0 with allOf transformations)
 * - Swagger 2.0 (upgraded to OpenAPI 3.0)
 *
 * @param schema - The OpenAPI document to convert
 * @returns Promise resolving to an OpenAPI 3.0 document
 *
 * @example Converting OpenAPI 3.1 to 3.0
 * ```typescript
 * const openapi31Doc = {
 *   openapi: "3.1.0",
 *   info: { title: "My API", version: "1.0.0" },
 *   paths: {}
 * };
 * const v3Doc = await toV3Document(openapi31Doc);
 * console.log(v3Doc.openapi); // "3.0.3" (converted)
 * ```
 *
 * @example Converting Swagger 2.0 to OpenAPI 3.0
 * ```typescript
 * const swagger2Doc = {
 *   swagger: "2.0",
 *   info: { title: "My API", version: "1.0.0" },
 *   paths: {}
 * };
 * const v3Doc = await toV3Document(swagger2Doc);
 * console.log(v3Doc.openapi); // "3.0.0" (converted)
 * ```
 *
 * @example OpenAPI 3.0 passthrough
 * ```typescript
 * const openapi30Doc = {
 *   openapi: "3.0.2",
 *   info: { title: "My API", version: "1.0.0" },
 *   paths: {}
 * };
 * const v3Doc = await toV3Document(openapi30Doc);
 * console.log(v3Doc === openapi30Doc); // true (same object)
 * ```
 *
 * @throws {Error} If the document version is not recognized or supported
 */
export const toV3Document = async (schema: AnyOasDocument): Promise<OpenAPIV3.Document> => {
  if ('openapi' in schema && typeof schema.openapi === 'string' && schema.openapi.startsWith('3.0')) {
    return schema as OpenAPIV3.Document
  }

  if ('openapi' in schema && typeof schema.openapi === 'string' && schema.openapi.startsWith('3.1')) {
    const options: ConverterOptions = {
      verbose: false,
      deleteExampleWithId: false,
      allOfTransform: true
    }

    const downConverter = new ThreeOneToThreeZeroConverter(
      schema as OpenAPIV3_1.Document,
      options
    )

    return downConverter.convert() as OpenAPIV3.Document
  }

  if ('swagger' in schema && typeof schema.swagger === 'string' && schema.swagger.startsWith('2.0')) {
    // Lazy import: `swagger2openapi` does `require('node:fs|path|url|http')`
    // at module init, which fails in restricted runtimes (CF Workers' V8
    // isolate). Deferring the import to this branch means OAS 3.0 / 3.1
    // inputs never trigger the load — `@skmtc/convert` becomes
    // Workers-portable for the common case.
    // @deno-types="npm:@types/swagger2openapi@7.0.4"
    const converter = (await import('swagger2openapi')).default
    const parsed = await converter.convertObj(schema as OpenAPIV2.Document, {})
    return parsed.openapi
  }

  const versionField =
    'openapi' in schema
      ? `openapi=${(schema as { openapi?: unknown }).openapi}`
      : 'swagger' in schema
        ? `swagger=${(schema as { swagger?: unknown }).swagger}`
        : 'no version field found'

  throw new Error(
    `Unrecognized OpenAPI version (${versionField}). Supported: OpenAPI 3.0.x, 3.1.x, and Swagger 2.0.`
  )
}
