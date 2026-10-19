import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type SecuritySchemeFields =
  | HttpSecuritySchemeFields
  | ApiKeySecuritySchemeFields
  | OAuth2SecuritySchemeFields
  | OpenIdSecuritySchemeFields

export type HttpSecuritySchemeFields = {
  description?: string
  deprecated?: boolean
  scheme: string
  bearerFormat?: string
}

export type ApiKeySecuritySchemeFields = {
  description?: string
  deprecated?: boolean
  name: string
  in: 'header' | 'query' | 'cookie'
}

export type OAuth2SecuritySchemeFields = {
  description?: string
  deprecated?: boolean
  oauth2MetadataUrl?: string
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
    deviceAuthorization?: {
      deviceAuthorizationUrl: string
      tokenUrl: string
      refreshUrl?: string | undefined
      scopes?: Record<string, string> | undefined
    }
  }
}

export type OpenIdSecuritySchemeFields = {
  description?: string
  deprecated?: boolean
  openIdConnectUrl: string
}

/** `OpenAPIV3.HttpSecurityScheme` with the OpenAPI 3.2 `deprecated` field. */
export type HttpSecuritySchemeJson = OpenAPIV3.HttpSecurityScheme & { deprecated?: boolean }

/** `OpenAPIV3.ApiKeySecurityScheme` with the OpenAPI 3.2 `deprecated` field. */
export type ApiKeySecuritySchemeJson = OpenAPIV3.ApiKeySecurityScheme & { deprecated?: boolean }

/** `OpenAPIV3.OpenIdSecurityScheme` with the OpenAPI 3.2 `deprecated` field. */
export type OpenIdSecuritySchemeJson = OpenAPIV3.OpenIdSecurityScheme & { deprecated?: boolean }

export class OasHttpSecurityScheme {
  oasType: 'securityScheme' = 'securityScheme'
  type: 'http' = 'http'
  description: string | undefined
  deprecated: boolean | undefined
  scheme: string
  bearerFormat: string | undefined

  constructor(fields: HttpSecuritySchemeFields) {
    this.description = fields.description
    this.deprecated = fields.deprecated
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

  toJsonSchema(): HttpSecuritySchemeJson {
    return {
      type: 'http',
      description: this.description,
      ...(this.deprecated === undefined ? {} : { deprecated: this.deprecated }),
      scheme: this.scheme,
      bearerFormat: this.bearerFormat
    }
  }
}

export class OasApiKeySecurityScheme {
  oasType: 'securityScheme' = 'securityScheme'
  type: 'apiKey' = 'apiKey'
  description: string | undefined
  deprecated: boolean | undefined
  name: string
  location: 'query' | 'header' | 'cookie'

  constructor(fields: ApiKeySecuritySchemeFields) {
    this.description = fields.description
    this.deprecated = fields.deprecated
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

  toJsonSchema(): ApiKeySecuritySchemeJson {
    return {
      type: 'apiKey',
      ...(this.deprecated === undefined ? {} : { deprecated: this.deprecated }),
      name: this.name,
      in: this.location
    }
  }
}

/**
 * `OpenAPIV3.OAuth2SecurityScheme` with the OpenAPI 3.2 fields:
 * `deprecated`, `oauth2MetadataUrl` and the `deviceAuthorization` flow.
 */
export type OAuth2SecuritySchemeJson = OpenAPIV3.OAuth2SecurityScheme & {
  deprecated?: boolean
  oauth2MetadataUrl?: string
  flows: OAuth2SecuritySchemeFields['flows']
}

export class OasOAuth2SecurityScheme {
  oasType: 'securityScheme' = 'securityScheme'
  type: 'oauth2' = 'oauth2'
  description: string | undefined
  deprecated: boolean | undefined
  oauth2MetadataUrl: string | undefined
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
    deviceAuthorization?: {
      deviceAuthorizationUrl: string
      tokenUrl: string
      refreshUrl?: string | undefined
      scopes?: Record<string, string> | undefined
    }
  }

  constructor(fields: OAuth2SecuritySchemeFields) {
    this.description = fields.description
    this.deprecated = fields.deprecated
    this.oauth2MetadataUrl = fields.oauth2MetadataUrl
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

  toJsonSchema(): OAuth2SecuritySchemeJson {
    return {
      type: 'oauth2',
      description: this.description,
      ...(this.deprecated === undefined ? {} : { deprecated: this.deprecated }),
      ...(this.oauth2MetadataUrl === undefined
        ? {}
        : { oauth2MetadataUrl: this.oauth2MetadataUrl }),
      flows: {
        authorizationCode: this.flows.authorizationCode,
        clientCredentials: this.flows.clientCredentials,
        implicit: this.flows.implicit,
        password: this.flows.password,
        ...(this.flows.deviceAuthorization === undefined
          ? {}
          : { deviceAuthorization: this.flows.deviceAuthorization })
      }
    }
  }
}

export class OasOpenIdSecurityScheme {
  oasType: 'securityScheme' = 'securityScheme'
  type: 'openIdConnect' = 'openIdConnect'
  description: string | undefined
  deprecated: boolean | undefined
  openIdConnectUrl: string

  constructor(fields: OpenIdSecuritySchemeFields) {
    this.description = fields.description
    this.deprecated = fields.deprecated
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

  toJsonSchema(): OpenIdSecuritySchemeJson {
    return {
      type: 'openIdConnect',
      description: this.description,
      ...(this.deprecated === undefined ? {} : { deprecated: this.deprecated }),
      openIdConnectUrl: this.openIdConnectUrl
    }
  }
}

export type OasSecurityScheme =
  | OasHttpSecurityScheme
  | OasApiKeySecurityScheme
  | OasOAuth2SecurityScheme
  | OasOpenIdSecurityScheme
