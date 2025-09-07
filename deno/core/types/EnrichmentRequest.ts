/**
 * @fileoverview Enrichment Request System for SKMTC Core
 * 
 * This module provides types for handling enrichment requests within the SKMTC
 * code generation pipeline. Enrichment requests allow generators to request
 * additional metadata and context about operations, schemas, and other OpenAPI
 * elements to enhance code generation with richer functionality.
 * 
 * The enrichment system enables generators to ask for specific data transformations,
 * UI component configurations, validation rules, and other metadata that can be
 * applied during the generation process to create more sophisticated output.
 * 
 * ## Key Features
 * 
 * - **Type-Safe Requests**: Generic typing ensures enrichment data matches expected schema
 * - **Flexible Content**: Support for any content type that needs enrichment
 * - **Schema Validation**: Valibot integration for runtime validation of enrichment data
 * - **Generator Integration**: Seamless integration with the generator pipeline
 * 
 * @example Creating an enrichment request
 * ```typescript
 * import { EnrichmentRequest } from '@skmtc/core/EnrichmentRequest';
 * import * as v from 'valibot';
 * 
 * const formEnrichmentSchema = v.object({
 *   title: v.string(),
 *   fields: v.array(v.object({
 *     name: v.string(),
 *     type: v.string(),
 *     required: v.boolean()
 *   }))
 * });
 * 
 * const request: EnrichmentRequest<typeof formEnrichmentSchema> = {
 *   prompt: 'Generate form metadata for user registration',
 *   enrichmentSchema: formEnrichmentSchema,
 *   content: JSON.stringify({ operationId: 'createUser', method: 'POST' })
 * };
 * ```
 * 
 * @example Processing enrichment in generators
 * ```typescript
 * function processEnrichment<T>(request: EnrichmentRequest<T>) {
 *   // Validate the enrichment data against the schema
 *   const enrichmentData = v.parse(request.enrichmentSchema, someData);
 *   
 *   // Use the enrichment data to enhance generation
 *   return generateEnhancedContent(request.content, enrichmentData);
 * }
 * ```
 * 
 * @module EnrichmentRequest
 */

import type * as v from 'valibot'

/**
 * Represents a request for enrichment data during code generation.
 * 
 * Enrichment requests allow generators to specify what additional metadata
 * they need for generating enhanced code artifacts. The request includes
 * a schema for validation and the content that needs enrichment.
 * 
 * @template EnrichmentType - The type of enrichment data being requested
 */
export type EnrichmentRequest<EnrichmentType = undefined> = {
  prompt: string
  enrichmentSchema: v.BaseSchema<EnrichmentType, EnrichmentType, v.BaseIssue<unknown>>
  content: string
}
