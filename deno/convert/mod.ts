/**
 * @module @skmtc/convert
 *
 * OpenAPI document conversion utilities for SKMTC.
 *
 * This module provides functions for converting OpenAPI documents between
 * different versions (Swagger 2.0, OpenAPI 3.0, OpenAPI 3.1) and formats
 * (JSON, YAML). All conversions normalize to OpenAPI 3.0 as the internal
 * processing format for SKMTC.
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
