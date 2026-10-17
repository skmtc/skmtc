import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

/**
 * Union type representing any supported OpenAPI document version.
 *
 * SKMTC supports processing OpenAPI/Swagger documents from version 2.0 through 3.2.
 * Swagger 2.0 is converted to OpenAPI 3.0; OpenAPI 3.0, 3.1 and 3.2 are parsed
 * natively. `openapi-types` has no 3.2 type, so a 3.2 document is typed as 3.1.
 */
export type AnyOasDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document
