import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type SecuritySchemeFields =
  | HttpSecuritySchemeFields
  | ApiKeySecuritySchemeFields
  | OAuth2SecuritySchemeFields
  | OpenIdSecuritySchemeFields

export type HttpSecuritySchemeFields = {
  description?: string
  scheme: string
  bearerFormat?: string
}

export type ApiKeySecuritySchemeFields = {
  description?: string
  name: string
  in: 'header' | 'query' | 'cookie'
}

export type OAuth2SecuritySchemeFields = {
  description?: string
  flows: {
    authorizationCode?: {
      authorizationUrl: string
      tokenUrl: string
      refreshUrl?: string | undefined
      scopes: Record<string, string>
    }
    clientCredentials?: {
      tokenUrl: string
      refreshUrl?: string | undefined
      scopes: Record<string, string>
    }
    implicit?: {
      authorizationUrl: string
      refreshUrl?: string | undefined
      scopes: Record<string, string>
    }
    password?: {
      tokenUrl: string
      refreshUrl?: string | undefined
      scopes: Record<string, string>
    }
  }
}

export type OpenIdSecuritySchemeFields = {
  description?: string
  openIdConnectUrl: string
}

export class OasHttpSecurityScheme {
  oasType: 'securityScheme' = 'securityScheme'
  type: 'http' = 'http'
  description: string | undefined
  scheme: string
  bearerFormat: string | undefined

  constructor(fields: HttpSecuritySchemeFields) {
    this.description = fields.description
    this.scheme = fields.scheme
    this.bearerFormat = fields.bearerFormat
  }

  isRef(): this is OasRef<'securityScheme'> {
    return false
  }

  resolve(): OasHttpSecurityScheme {
    return this
  }

  resolveOnce(): OasHttpSecurityScheme {
    return this
  }

  toJsonSchema(): OpenAPIV3.HttpSecurityScheme {
    return {
      type: 'http',
      description: this.description,
      scheme: this.scheme,
      bearerFormat: this.bearerFormat
    }
  }
}

export class OasApiKeySecurityScheme {
  oasType: 'securityScheme' = 'securityScheme'
  type: 'apiKey' = 'apiKey'
  description: string | undefined
  name: string
  location: 'query' | 'header' | 'cookie'

  constructor(fields: ApiKeySecuritySchemeFields) {
    this.description = fields.description
    this.name = fields.name
    this.location = fields.in
  }

  isRef(): this is OasRef<'securityScheme'> {
    return false
  }

  resolve(): OasApiKeySecurityScheme {
    return this
  }

  resolveOnce(): OasApiKeySecurityScheme {
    return this
  }

  toJsonSchema(): OpenAPIV3.ApiKeySecurityScheme {
    return {
      type: 'apiKey',
      name: this.name,
      in: this.location
    }
  }
}

export class OasOAuth2SecurityScheme {
  oasType: 'securityScheme' = 'securityScheme'
  type: 'oauth2' = 'oauth2'
  description: string | undefined
  flows: {
    authorizationCode?: {
      authorizationUrl: string
      tokenUrl: string
      refreshUrl?: string | undefined
      scopes: Record<string, string>
    }
    clientCredentials?: {
      tokenUrl: string
      refreshUrl?: string | undefined
      scopes: Record<string, string>
    }
    implicit?: {
      authorizationUrl: string
      refreshUrl?: string | undefined
      scopes: Record<string, string>
    }
    password?: {
      tokenUrl: string
      refreshUrl?: string | undefined
      scopes: Record<string, string>
    }
  }

  constructor(fields: OAuth2SecuritySchemeFields) {
    this.description = fields.description
    this.flows = fields.flows
  }

  isRef(): this is OasRef<'securityScheme'> {
    return false
  }

  resolve(): OasOAuth2SecurityScheme {
    return this
  }

  resolveOnce(): OasOAuth2SecurityScheme {
    return this
  }

  toJsonSchema(): OpenAPIV3.OAuth2SecurityScheme {
    return {
      type: 'oauth2',
      description: this.description,
      flows: {
        authorizationCode: this.flows.authorizationCode,
        clientCredentials: this.flows.clientCredentials,
        implicit: this.flows.implicit,
        password: this.flows.password
      }
    }
  }
}

export class OasOpenIdSecurityScheme {
  oasType: 'securityScheme' = 'securityScheme'
  type: 'openIdConnect' = 'openIdConnect'
  description: string | undefined
  openIdConnectUrl: string

  constructor(fields: OpenIdSecuritySchemeFields) {
    this.description = fields.description
    this.openIdConnectUrl = fields.openIdConnectUrl
  }

  isRef(): this is OasRef<'securityScheme'> {
    return false
  }

  resolve(): OasOpenIdSecurityScheme {
    return this
  }

  resolveOnce(): OasOpenIdSecurityScheme {
    return this
  }

  toJsonSchema(): OpenAPIV3.OpenIdSecurityScheme {
    return {
      type: 'openIdConnect',
      description: this.description,
      openIdConnectUrl: this.openIdConnectUrl
    }
  }
}

export type OasSecurityScheme =
  | OasHttpSecurityScheme
  | OasApiKeySecurityScheme
  | OasOAuth2SecurityScheme
  | OasOpenIdSecurityScheme
