import * as v from 'valibot'

export type OasHttpSecuritySchemeData = {
  type: 'http'
  description?: string
  scheme: string
  bearerFormat?: string
}

export const oasHttpSecuritySchemeData = v.object({
  type: v.literal('http'),
  description: v.optional(v.string()),
  scheme: v.string(),
  bearerFormat: v.optional(v.string())
})

export type OasApiKeySecuritySchemeData = {
  type: 'apiKey'
  description?: string
  name: string
  in: 'header' | 'query' | 'cookie'
}

export const oasApiKeySecuritySchemeData = v.object({
  type: v.literal('apiKey'),
  description: v.optional(v.string()),
  name: v.string(),
  in: v.union([v.literal('header'), v.literal('query'), v.literal('cookie')])
})

export type OasImplicitOAuth2FlowData = {
  authorizationUrl: string
  refreshUrl: string | undefined
  scopes: Record<string, string>
}

export const oasImplicitOAuth2FlowData = v.object({
  authorizationUrl: v.string(),
  refreshUrl: v.optional(v.string()),
  scopes: v.record(v.string(), v.string())
})

export type OasAuthorizationCodeOAuth2FlowData = {
  authorizationUrl: string
  tokenUrl: string
  refreshUrl: string | undefined
  scopes: Record<string, string>
}

export const oasAuthorizationCodeOAuth2FlowData = v.object({
  authorizationUrl: v.string(),
  tokenUrl: v.string(),
  refreshUrl: v.optional(v.string()),
  scopes: v.record(v.string(), v.string())
})

export type OasClientCredentialsOAuth2FlowData = {
  tokenUrl: string
  refreshUrl: string | undefined
  scopes: Record<string, string>
}

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
  authorizationCode: OasAuthorizationCodeOAuth2FlowData
  clientCredentials: OasClientCredentialsOAuth2FlowData
  implicit: OasImplicitOAuth2FlowData
  password: OasPasswordOAuth2FlowData
}

export const oasOAuth2FlowsData = v.object({
  authorizationCode: oasAuthorizationCodeOAuth2FlowData,
  clientCredentials: oasClientCredentialsOAuth2FlowData,
  implicit: oasImplicitOAuth2FlowData,
  password: oasPasswordOAuth2FlowData
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
