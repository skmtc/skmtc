import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

/**
 * Union type representing any supported OpenAPI document version.
 *
 * SKMTC supports processing OpenAPI/Swagger documents from version 2.0 through 3.1,
 * automatically converting them to OpenAPI 3.0 format for internal processing.
 */
export type AnyOasDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document
