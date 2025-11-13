import { assertEquals, assertStrictEquals } from '@std/assert'
import {
  OasHttpSecurityScheme,
  OasApiKeySecurityScheme,
  OasOAuth2SecurityScheme,
  OasOpenIdSecurityScheme
} from './SecurityScheme.ts'

Deno.test('OasHttpSecurityScheme - constructor sets all fields correctly', () => {
  const scheme = new OasHttpSecurityScheme({
    description: 'Bearer authentication',
    scheme: 'bearer',
    bearerFormat: 'JWT'
  })

  assertEquals(scheme.description, 'Bearer authentication')
  assertEquals(scheme.scheme, 'bearer')
  assertEquals(scheme.bearerFormat, 'JWT')
  assertEquals(scheme.type, 'http')
  assertEquals(scheme.oasType, 'securityScheme')
})

Deno.test('OasHttpSecurityScheme - constructor with minimal fields', () => {
  const scheme = new OasHttpSecurityScheme({
    scheme: 'basic'
  })

  assertEquals(scheme.scheme, 'basic')
  assertEquals(scheme.description, undefined)
  assertEquals(scheme.bearerFormat, undefined)
  assertEquals(scheme.type, 'http')
})

Deno.test('OasHttpSecurityScheme - isRef() returns false', () => {
  const scheme = new OasHttpSecurityScheme({ scheme: 'bearer' })

  assertEquals(scheme.isRef(), false)
})

Deno.test('OasHttpSecurityScheme - resolve() returns itself', () => {
  const scheme = new OasHttpSecurityScheme({ scheme: 'bearer' })
  const resolved = scheme.resolve()

  assertStrictEquals(resolved, scheme)
})

Deno.test('OasHttpSecurityScheme - resolveOnce() returns itself', () => {
  const scheme = new OasHttpSecurityScheme({ scheme: 'bearer' })
  const resolved = scheme.resolveOnce()

  assertStrictEquals(resolved, scheme)
})

Deno.test('OasHttpSecurityScheme - toJsonSchema() with all fields', () => {
  const scheme = new OasHttpSecurityScheme({
    description: 'JWT Bearer',
    scheme: 'bearer',
    bearerFormat: 'JWT'
  })

  const jsonSchema = scheme.toJsonSchema()

  assertEquals(jsonSchema, {
    type: 'http',
    description: 'JWT Bearer',
    scheme: 'bearer',
    bearerFormat: 'JWT'
  })
})

Deno.test('OasHttpSecurityScheme - toJsonSchema() with minimal fields', () => {
  const scheme = new OasHttpSecurityScheme({
    scheme: 'basic'
  })

  const jsonSchema = scheme.toJsonSchema()

  assertEquals(jsonSchema, {
    type: 'http',
    description: undefined,
    scheme: 'basic',
    bearerFormat: undefined
  })
})

Deno.test('OasApiKeySecurityScheme - constructor with header location', () => {
  const scheme = new OasApiKeySecurityScheme({
    description: 'API Key in header',
    name: 'X-API-Key',
    in: 'header'
  })

  assertEquals(scheme.description, 'API Key in header')
  assertEquals(scheme.name, 'X-API-Key')
  assertEquals(scheme.location, 'header')
  assertEquals(scheme.type, 'apiKey')
  assertEquals(scheme.oasType, 'securityScheme')
})

Deno.test('OasApiKeySecurityScheme - constructor with query location', () => {
  const scheme = new OasApiKeySecurityScheme({
    name: 'api_key',
    in: 'query'
  })

  assertEquals(scheme.name, 'api_key')
  assertEquals(scheme.location, 'query')
  assertEquals(scheme.description, undefined)
})

Deno.test('OasApiKeySecurityScheme - constructor with cookie location', () => {
  const scheme = new OasApiKeySecurityScheme({
    name: 'session',
    in: 'cookie'
  })

  assertEquals(scheme.name, 'session')
  assertEquals(scheme.location, 'cookie')
})

Deno.test('OasApiKeySecurityScheme - isRef() returns false', () => {
  const scheme = new OasApiKeySecurityScheme({
    name: 'api_key',
    in: 'header'
  })

  assertEquals(scheme.isRef(), false)
})

Deno.test('OasApiKeySecurityScheme - resolve() returns itself', () => {
  const scheme = new OasApiKeySecurityScheme({
    name: 'api_key',
    in: 'header'
  })
  const resolved = scheme.resolve()

  assertStrictEquals(resolved, scheme)
})

Deno.test('OasApiKeySecurityScheme - resolveOnce() returns itself', () => {
  const scheme = new OasApiKeySecurityScheme({
    name: 'api_key',
    in: 'header'
  })
  const resolved = scheme.resolveOnce()

  assertStrictEquals(resolved, scheme)
})

Deno.test('OasApiKeySecurityScheme - toJsonSchema() returns correct structure', () => {
  const scheme = new OasApiKeySecurityScheme({
    description: 'API Key authentication',
    name: 'X-API-Key',
    in: 'header'
  })

  const jsonSchema = scheme.toJsonSchema()

  assertEquals(jsonSchema, {
    type: 'apiKey',
    name: 'X-API-Key',
    in: 'header'
  })
})

Deno.test('OasApiKeySecurityScheme - toJsonSchema() does not include description', () => {
  const scheme = new OasApiKeySecurityScheme({
    description: 'This should not appear in JSON schema',
    name: 'api_key',
    in: 'query'
  })

  const jsonSchema = scheme.toJsonSchema()

  // Description is not included in the JSON schema for API Key
  assertEquals(jsonSchema.hasOwnProperty('description'), false)
  assertEquals(jsonSchema, {
    type: 'apiKey',
    name: 'api_key',
    in: 'query'
  })
})

Deno.test('OasOAuth2SecurityScheme - constructor with authorizationCode flow', () => {
  const scheme = new OasOAuth2SecurityScheme({
    description: 'OAuth2 authorization code flow',
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        refreshUrl: 'https://example.com/oauth/refresh',
        scopes: {
          'read:users': 'Read user data',
          'write:users': 'Write user data'
        }
      }
    }
  })

  assertEquals(scheme.description, 'OAuth2 authorization code flow')
  assertEquals(scheme.type, 'oauth2')
  assertEquals(scheme.oasType, 'securityScheme')
  assertEquals(scheme.flows.authorizationCode?.authorizationUrl, 'https://example.com/oauth/authorize')
  assertEquals(scheme.flows.authorizationCode?.tokenUrl, 'https://example.com/oauth/token')
  assertEquals(scheme.flows.authorizationCode?.refreshUrl, 'https://example.com/oauth/refresh')
  assertEquals(scheme.flows.authorizationCode?.scopes, {
    'read:users': 'Read user data',
    'write:users': 'Write user data'
  })
})

Deno.test('OasOAuth2SecurityScheme - constructor with clientCredentials flow', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      clientCredentials: {
        tokenUrl: 'https://example.com/oauth/token',
        scopes: {
          'api:read': 'Read API'
        }
      }
    }
  })

  assertEquals(scheme.flows.clientCredentials?.tokenUrl, 'https://example.com/oauth/token')
  assertEquals(scheme.flows.clientCredentials?.scopes, { 'api:read': 'Read API' })
  assertEquals(scheme.flows.clientCredentials?.refreshUrl, undefined)
})

Deno.test('OasOAuth2SecurityScheme - constructor with implicit flow', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      implicit: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        scopes: {
          'openid': 'OpenID Connect'
        }
      }
    }
  })

  assertEquals(scheme.flows.implicit?.authorizationUrl, 'https://example.com/oauth/authorize')
  assertEquals(scheme.flows.implicit?.scopes, { 'openid': 'OpenID Connect' })
})

Deno.test('OasOAuth2SecurityScheme - constructor with password flow', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      password: {
        tokenUrl: 'https://example.com/oauth/token',
        scopes: {}
      }
    }
  })

  assertEquals(scheme.flows.password?.tokenUrl, 'https://example.com/oauth/token')
  assertEquals(scheme.flows.password?.scopes, {})
})

Deno.test('OasOAuth2SecurityScheme - constructor with multiple flows', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        scopes: { 'read': 'Read access' }
      },
      clientCredentials: {
        tokenUrl: 'https://example.com/oauth/token',
        scopes: { 'admin': 'Admin access' }
      }
    }
  })

  assertEquals(scheme.flows.authorizationCode?.scopes, { 'read': 'Read access' })
  assertEquals(scheme.flows.clientCredentials?.scopes, { 'admin': 'Admin access' })
})

Deno.test('OasOAuth2SecurityScheme - isRef() returns false', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      implicit: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        scopes: {}
      }
    }
  })

  assertEquals(scheme.isRef(), false)
})

Deno.test('OasOAuth2SecurityScheme - resolve() returns itself', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      implicit: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        scopes: {}
      }
    }
  })
  const resolved = scheme.resolve()

  assertStrictEquals(resolved, scheme)
})

Deno.test('OasOAuth2SecurityScheme - resolveOnce() returns itself', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      implicit: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        scopes: {}
      }
    }
  })
  const resolved = scheme.resolveOnce()

  assertStrictEquals(resolved, scheme)
})

Deno.test('OasOAuth2SecurityScheme - toJsonSchema() with single flow', () => {
  const scheme = new OasOAuth2SecurityScheme({
    description: 'OAuth2',
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        scopes: { 'read': 'Read' }
      }
    }
  })

  const jsonSchema = scheme.toJsonSchema()

  assertEquals(jsonSchema, {
    type: 'oauth2',
    description: 'OAuth2',
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        scopes: { 'read': 'Read' }
      },
      clientCredentials: undefined,
      implicit: undefined,
      password: undefined
    }
  })
})

Deno.test('OasOAuth2SecurityScheme - toJsonSchema() with all flows', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        scopes: {}
      },
      clientCredentials: {
        tokenUrl: 'https://example.com/oauth/token',
        scopes: {}
      },
      implicit: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        scopes: {}
      },
      password: {
        tokenUrl: 'https://example.com/oauth/token',
        scopes: {}
      }
    }
  })

  const jsonSchema = scheme.toJsonSchema()

  assertEquals(jsonSchema.type, 'oauth2')
  assertEquals(jsonSchema.flows.authorizationCode !== undefined, true)
  assertEquals(jsonSchema.flows.clientCredentials !== undefined, true)
  assertEquals(jsonSchema.flows.implicit !== undefined, true)
  assertEquals(jsonSchema.flows.password !== undefined, true)
})

Deno.test('OasOpenIdSecurityScheme - constructor with all fields', () => {
  const scheme = new OasOpenIdSecurityScheme({
    description: 'OpenID Connect authentication',
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })

  assertEquals(scheme.description, 'OpenID Connect authentication')
  assertEquals(scheme.openIdConnectUrl, 'https://example.com/.well-known/openid-configuration')
  assertEquals(scheme.type, 'openIdConnect')
  assertEquals(scheme.oasType, 'securityScheme')
})

Deno.test('OasOpenIdSecurityScheme - constructor with minimal fields', () => {
  const scheme = new OasOpenIdSecurityScheme({
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })

  assertEquals(scheme.openIdConnectUrl, 'https://example.com/.well-known/openid-configuration')
  assertEquals(scheme.description, undefined)
})

Deno.test('OasOpenIdSecurityScheme - isRef() returns false', () => {
  const scheme = new OasOpenIdSecurityScheme({
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })

  assertEquals(scheme.isRef(), false)
})

Deno.test('OasOpenIdSecurityScheme - resolve() returns itself', () => {
  const scheme = new OasOpenIdSecurityScheme({
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })
  const resolved = scheme.resolve()

  assertStrictEquals(resolved, scheme)
})

Deno.test('OasOpenIdSecurityScheme - resolveOnce() returns itself', () => {
  const scheme = new OasOpenIdSecurityScheme({
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })
  const resolved = scheme.resolveOnce()

  assertStrictEquals(resolved, scheme)
})

Deno.test('OasOpenIdSecurityScheme - toJsonSchema() with all fields', () => {
  const scheme = new OasOpenIdSecurityScheme({
    description: 'OpenID Connect',
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })

  const jsonSchema = scheme.toJsonSchema()

  assertEquals(jsonSchema, {
    type: 'openIdConnect',
    description: 'OpenID Connect',
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })
})

Deno.test('OasOpenIdSecurityScheme - toJsonSchema() with minimal fields', () => {
  const scheme = new OasOpenIdSecurityScheme({
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })

  const jsonSchema = scheme.toJsonSchema()

  assertEquals(jsonSchema, {
    type: 'openIdConnect',
    description: undefined,
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })
})

Deno.test('OasHttpSecurityScheme - multiple instances are independent', () => {
  const scheme1 = new OasHttpSecurityScheme({ scheme: 'bearer', bearerFormat: 'JWT' })
  const scheme2 = new OasHttpSecurityScheme({ scheme: 'basic' })

  assertEquals(scheme1 !== scheme2, true)
  assertEquals(scheme1.scheme, 'bearer')
  assertEquals(scheme2.scheme, 'basic')
})

Deno.test('OasApiKeySecurityScheme - location mapping from "in" to "location"', () => {
  // Verify that "in" field is correctly mapped to "location" property
  const headerScheme = new OasApiKeySecurityScheme({ name: 'key', in: 'header' })
  const queryScheme = new OasApiKeySecurityScheme({ name: 'key', in: 'query' })
  const cookieScheme = new OasApiKeySecurityScheme({ name: 'key', in: 'cookie' })

  assertEquals(headerScheme.location, 'header')
  assertEquals(queryScheme.location, 'query')
  assertEquals(cookieScheme.location, 'cookie')
})

Deno.test('OasOAuth2SecurityScheme - empty scopes object is valid', () => {
  const scheme = new OasOAuth2SecurityScheme({
    flows: {
      clientCredentials: {
        tokenUrl: 'https://example.com/token',
        scopes: {}
      }
    }
  })

  assertEquals(scheme.flows.clientCredentials?.scopes, {})
})

Deno.test('All security schemes - oasType is consistently "securityScheme"', () => {
  const httpScheme = new OasHttpSecurityScheme({ scheme: 'bearer' })
  const apiKeyScheme = new OasApiKeySecurityScheme({ name: 'key', in: 'header' })
  const oauth2Scheme = new OasOAuth2SecurityScheme({
    flows: {
      implicit: { authorizationUrl: 'https://example.com/oauth', scopes: {} }
    }
  })
  const openIdScheme = new OasOpenIdSecurityScheme({
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })

  assertEquals(httpScheme.oasType, 'securityScheme')
  assertEquals(apiKeyScheme.oasType, 'securityScheme')
  assertEquals(oauth2Scheme.oasType, 'securityScheme')
  assertEquals(openIdScheme.oasType, 'securityScheme')
})
