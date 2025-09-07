import * as v from 'valibot'

/**
 * Data type for HTTP authentication security schemes.
 * 
 * Represents HTTP authentication mechanisms like Basic, Bearer,
 * and other HTTP authentication schemes as defined in RFC 7235.
 */
export type OasHttpSecuritySchemeData = {
  /** Security scheme type identifier */
  type: 'http'
  /** Human-readable description of the security scheme */
  description?: string
  /** HTTP authorization scheme (e.g., 'basic', 'bearer') */
  scheme: string
  /** Format hint for bearer tokens (e.g., 'JWT') */
  bearerFormat?: string
}

/**
 * Valibot schema for validating HTTP security scheme data.
 */
export const oasHttpSecuritySchemeData = v.object({
  type: v.literal('http'),
  description: v.optional(v.string()),
  scheme: v.string(),
  bearerFormat: v.optional(v.string())
})

/**
 * Data type for API key authentication security schemes.
 * 
 * Represents API key authentication where the key is passed
 * via header, query parameter, or cookie.
 */
export type OasApiKeySecuritySchemeData = {
  /** Security scheme type identifier */
  type: 'apiKey'
  /** Human-readable description of the security scheme */
  description?: string
  /** Name of the header, query parameter, or cookie */
  name: string
  /** Location where the API key should be sent */
  in: 'header' | 'query' | 'cookie'
}

/**
 * Valibot schema for validating API key security scheme data.
 */
export const oasApiKeySecuritySchemeData = v.object({
  type: v.literal('apiKey'),
  description: v.optional(v.string()),
  name: v.string(),
  in: v.union([v.literal('header'), v.literal('query'), v.literal('cookie')])
})

/**
 * Data type for OAuth2 implicit flow configuration.
 * 
 * Represents the implicit OAuth2 flow where tokens are obtained
 * directly from the authorization endpoint without client authentication.
 */
export type OasImplicitOAuth2FlowData = {
  /** URL for the OAuth2 authorization endpoint */
  authorizationUrl: string
  /** Optional URL for token refresh */
  refreshUrl: string | undefined
  /** Available scopes mapped to their descriptions */
  scopes: Record<string, string>
}

/**
 * Valibot schema for validating OAuth2 implicit flow data.
 */
export const oasImplicitOAuth2FlowData = v.object({
  authorizationUrl: v.string(),
  refreshUrl: v.optional(v.string()),
  scopes: v.record(v.string(), v.string())
})

/**
 * Data type for OAuth2 authorization code flow configuration.
 * 
 * Represents the authorization code OAuth2 flow, the most secure
 * flow suitable for server-side applications with client authentication.
 */
export type OasAuthorizationCodeOAuth2FlowData = {
  /** URL for the OAuth2 authorization endpoint */
  authorizationUrl: string
  /** URL for the OAuth2 token endpoint */
  tokenUrl: string
  /** Optional URL for token refresh */
  refreshUrl: string | undefined
  /** Available scopes mapped to their descriptions */
  scopes: Record<string, string>
}

/**
 * Valibot schema for validating OAuth2 authorization code flow data.
 */
export const oasAuthorizationCodeOAuth2FlowData = v.object({
  authorizationUrl: v.string(),
  tokenUrl: v.string(),
  refreshUrl: v.optional(v.string()),
  scopes: v.record(v.string(), v.string())
})

/**
 * Data type for OAuth2 client credentials flow configuration.
 * 
 * Represents the client credentials OAuth2 flow used for
 * server-to-server authentication without user involvement.
 */
export type OasClientCredentialsOAuth2FlowData = {
  /** URL for the OAuth2 token endpoint */
  tokenUrl: string
  /** Optional URL for token refresh */
  refreshUrl: string | undefined
  /** Available scopes mapped to their descriptions */
  scopes: Record<string, string>
}

/**
 * Valibot schema for validating OAuth2 client credentials flow data.
 */
export const oasClientCredentialsOAuth2FlowData = v.object({
  tokenUrl: v.string(),
  refreshUrl: v.optional(v.string()),
  scopes: v.record(v.string(), v.string())
})

export type OasPasswordOAuth2FlowData = {
  tokenUrl: string
  refreshUrl: string | undefined
  scopes: Record<string, string>
}

export const oasPasswordOAuth2FlowData = v.object({
  tokenUrl: v.string(),
  refreshUrl: v.optional(v.string()),
  scopes: v.record(v.string(), v.string())
})

export type OasOAuth2FlowsData = {
  authorizationCode?: OasAuthorizationCodeOAuth2FlowData
  clientCredentials?: OasClientCredentialsOAuth2FlowData
  implicit?: OasImplicitOAuth2FlowData
  password?: OasPasswordOAuth2FlowData
}

export const oasOAuth2FlowsData = v.object({
  authorizationCode: v.optional(oasAuthorizationCodeOAuth2FlowData),
  clientCredentials: v.optional(oasClientCredentialsOAuth2FlowData),
  implicit: v.optional(oasImplicitOAuth2FlowData),
  password: v.optional(oasPasswordOAuth2FlowData)
})

export type OasOAuth2SecuritySchemeData = {
  type: 'oauth2'
  description?: string
  flows: OasOAuth2FlowsData
}

export const oasOAuth2SecuritySchemeData = v.object({
  type: v.literal('oauth2'),
  description: v.optional(v.string()),
  flows: oasOAuth2FlowsData
})

export type OasOpenIdSecuritySchemeData = {
  type: 'openIdConnect'
  description?: string
  openIdConnectUrl: string
}

export const oasOpenIdSecuritySchemeData = v.object({
  type: v.literal('openIdConnect'),
  description: v.optional(v.string()),
  openIdConnectUrl: v.string()
})

export type OasSecuritySchemeData =
  | OasHttpSecuritySchemeData
  | OasApiKeySecuritySchemeData
  | OasOAuth2SecuritySchemeData
  | OasOpenIdSecuritySchemeData

export const oasSecuritySchemeData = v.union([
  oasHttpSecuritySchemeData,
  oasApiKeySecuritySchemeData,
  oasOAuth2SecuritySchemeData,
  oasOpenIdSecuritySchemeData
])
