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

import type { OpenAPIV3 } from 'openapi-types'
import { parse as parseYaml } from '@std/yaml/parse'
import type { JsonValue } from '@skmtc/swagger2openapi/converter'
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
 * Normalize an OpenAPI document to a version SKMTC can parse directly.
 *
 * SKMTC parses OpenAPI 3.0 and 3.1 natively (`core/parse/v3-0`,
 * `core/parse/v3-1`), so only Swagger 2.0 is converted:
 * - OpenAPI 3.0.x (returned as-is)
 * - OpenAPI 3.1.x (returned as-is — parsed natively, no down-convert)
 * - Swagger 2.0 (upgraded to OpenAPI 3.0)
 *
 * @param schema - The OpenAPI / Swagger document to normalize
 * @returns Promise resolving to a 3.0 or 3.1 document (2.0 is converted to 3.0)
 *
 * @example OpenAPI 3.1 passthrough
 * ```typescript
 * const openapi31Doc = {
 *   openapi: "3.1.0",
 *   info: { title: "My API", version: "1.0.0" }
 * };
 * const doc = await toV3Document(openapi31Doc);
 * console.log(doc.openapi); // "3.1.0" (unchanged — parsed natively)
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
  if (
    'openapi' in schema &&
    typeof schema.openapi === 'string' &&
    schema.openapi.startsWith('3.0')
  ) {
    return schema as OpenAPIV3.Document
  }

  if (
    'openapi' in schema &&
    typeof schema.openapi === 'string' &&
    schema.openapi.startsWith('3.1')
  ) {
    // SKMTC parses OpenAPI 3.1 natively (core/parse/v3-1), so 3.1 documents
    // pass through unchanged — no down-convert. The native parser reads the
    // 3.1 idioms directly (type arrays, const, {type:'null'}, numeric
    // exclusive bounds, examples[], webhooks). Only Swagger 2.0 (below) still
    // needs an upstream conversion.
    return schema as OpenAPIV3.Document
  }

  if (
    'swagger' in schema &&
    typeof schema.swagger === 'string' &&
    schema.swagger.startsWith('2.0')
  ) {
    // Import the converter-only subpath, NOT the package root: the root
    // (`mod.ts`) re-exports the ajv-based validator, whose `ajv-draft-04`
    // CJS deep-requires bloat the bundle and trip stricter bundlers. The
    // `/converter` subpath has zero ajv and zero `node:` built-ins, so
    // `@skmtc/convert` stays lean and Workers-portable. Kept lazy so the
    // common OAS 3.0 / 3.1 cases never load it at all. `convertObj` is
    // synchronous (pure object manipulation).
    const { convertObj } = await import('@skmtc/swagger2openapi/converter')
    const { openapi } = convertObj(schema as unknown as JsonValue, {})
    return openapi as unknown as OpenAPIV3.Document
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
