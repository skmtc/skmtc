/**
 * @module @skmtc/convert
 *
 * OpenAPI document conversion utilities for SKMTC.
 *
 * This module provides functions for converting OpenAPI documents between
 * different versions (Swagger 2.0, OpenAPI 3.0, 3.1 and 3.2) and formats
 * (JSON, YAML). Swagger 2.0 is converted to OpenAPI 3.0; OpenAPI 3.0, 3.1 and
 * 3.2 pass through unchanged, because SKMTC parses each of them natively.
 *
 * @example
 * ```typescript
 * import { toV3Document, stringToSchema } from '@skmtc/convert';
 *
 * // Parse and convert
 * const yamlDoc = `
 * openapi: 3.1.0
 * info:
 *   title: My API
 *   version: 1.0.0
 * `;
 * const parsed = stringToSchema(yamlDoc);
 * const v3Doc = await toV3Document(parsed);
 * ```
 */

export { stringToSchema, toV3Document } from './toV3Document.ts'
export type { AnyOasDocument } from './types.ts'
