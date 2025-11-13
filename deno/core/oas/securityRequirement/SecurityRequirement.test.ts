import { assertEquals, assertStrictEquals } from '@std/assert'
import { OasSecurityRequirement } from './SecurityRequirement.ts'
import { OasHttpSecurityScheme, OasApiKeySecurityScheme, OasOAuth2SecurityScheme, OasOpenIdSecurityScheme } from '../securitySchemes/SecurityScheme.ts'
import type { OasDocument } from '../document/Document.ts'

// Helper function to create a mock OasDocument with security schemes
const createMockDocument = (securitySchemes?: Record<string, any>): OasDocument => {
  return {
    components: {
      securitySchemes: securitySchemes
    }
  } as OasDocument
}

Deno.test('OasSecurityRequirement - constructor with single security scheme and empty scopes', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: {
      'api_key': []
    }
  }, mockDoc)

  assertEquals(securityReq.oasType, 'securityRequirement')
  assertEquals(securityReq.requirement, { 'api_key': [] })
})

Deno.test('OasSecurityRequirement - constructor with single scheme and multiple scopes', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: {
      'oauth2': ['read:users', 'write:users', 'delete:users']
    }
  }, mockDoc)

  assertEquals(securityReq.requirement, {
    'oauth2': ['read:users', 'write:users', 'delete:users']
  })
})

Deno.test('OasSecurityRequirement - constructor with multiple security schemes', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: {
      'api_key': [],
      'oauth2': ['read:users'],
      'bearer': []
    }
  }, mockDoc)

  assertEquals(Object.keys(securityReq.requirement).length, 3)
  assertEquals(securityReq.requirement['api_key'], [])
  assertEquals(securityReq.requirement['oauth2'], ['read:users'])
  assertEquals(securityReq.requirement['bearer'], [])
})

Deno.test('OasSecurityRequirement - constructor with empty requirement object', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: {}
  }, mockDoc)

  assertEquals(securityReq.requirement, {})
  assertEquals(Object.keys(securityReq.requirement).length, 0)
})

Deno.test('OasSecurityRequirement - oasType property is always "securityRequirement"', () => {
  const mockDoc = createMockDocument()
  const securityReq1 = new OasSecurityRequirement({ requirement: { 'api_key': [] } }, mockDoc)
  const securityReq2 = new OasSecurityRequirement({ requirement: {} }, mockDoc)
  const securityReq3 = new OasSecurityRequirement({ requirement: { 'oauth2': ['read', 'write'] } }, mockDoc)

  assertEquals(securityReq1.oasType, 'securityRequirement')
  assertEquals(securityReq2.oasType, 'securityRequirement')
  assertEquals(securityReq3.oasType, 'securityRequirement')
})

Deno.test('OasSecurityRequirement - requirement property returns correct mapping', () => {
  const mockDoc = createMockDocument()
  const requirement = {
    'oauth2': ['read:users', 'write:users'],
    'api_key': []
  }
  const securityReq = new OasSecurityRequirement({ requirement }, mockDoc)

  assertEquals(securityReq.requirement, requirement)
  assertStrictEquals(securityReq.requirement, requirement)
})

Deno.test('OasSecurityRequirement - multiple instances are independent', () => {
  const mockDoc = createMockDocument()
  const securityReq1 = new OasSecurityRequirement({
    requirement: { 'api_key': [] }
  }, mockDoc)
  const securityReq2 = new OasSecurityRequirement({
    requirement: { 'oauth2': ['read'] }
  }, mockDoc)

  assertEquals(securityReq1 !== securityReq2, true)
  assertEquals(securityReq1.requirement, { 'api_key': [] })
  assertEquals(securityReq2.requirement, { 'oauth2': ['read'] })
})

Deno.test('OasSecurityRequirement - toSecurityScheme() returns empty array when no schemes in document', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: { 'api_key': [] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes, [])
})

Deno.test('OasSecurityRequirement - toSecurityScheme() returns empty array when document has no components', () => {
  const mockDoc = {} as OasDocument
  const securityReq = new OasSecurityRequirement({
    requirement: { 'api_key': [] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes, [])
})

Deno.test('OasSecurityRequirement - toSecurityScheme() returns single security scheme', () => {
  const apiKeyScheme = new OasApiKeySecurityScheme({
    name: 'X-API-Key',
    in: 'header'
  })

  const mockDoc = createMockDocument({
    'api_key': apiKeyScheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: { 'api_key': [] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes.length, 1)
  assertStrictEquals(schemes[0], apiKeyScheme)
})

Deno.test('OasSecurityRequirement - toSecurityScheme() returns multiple security schemes', () => {
  const apiKeyScheme = new OasApiKeySecurityScheme({
    name: 'X-API-Key',
    in: 'header'
  })

  const bearerScheme = new OasHttpSecurityScheme({
    scheme: 'bearer',
    bearerFormat: 'JWT'
  })

  const mockDoc = createMockDocument({
    'api_key': apiKeyScheme,
    'bearer': bearerScheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: {
      'api_key': [],
      'bearer': []
    }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes.length, 2)
  assertEquals(schemes.includes(apiKeyScheme), true)
  assertEquals(schemes.includes(bearerScheme), true)
})

Deno.test('OasSecurityRequirement - toSecurityScheme() filters out undefined schemes', () => {
  const apiKeyScheme = new OasApiKeySecurityScheme({
    name: 'X-API-Key',
    in: 'header'
  })

  const mockDoc = createMockDocument({
    'api_key': apiKeyScheme
    // 'missing_scheme' is not defined
  })

  const securityReq = new OasSecurityRequirement({
    requirement: {
      'api_key': [],
      'missing_scheme': []
    }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  // Should only return the api_key scheme, filtering out missing_scheme
  assertEquals(schemes.length, 1)
  assertStrictEquals(schemes[0], apiKeyScheme)
})

Deno.test('OasSecurityRequirement - toSecurityScheme() handles missing securitySchemes property', () => {
  const mockDoc = {
    components: {}
  } as OasDocument

  const securityReq = new OasSecurityRequirement({
    requirement: { 'api_key': [] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes, [])
})

Deno.test('OasSecurityRequirement - toSecurityScheme() calls resolve() on schemes', () => {
  // Create a scheme to verify resolve() is called
  const httpScheme = new OasHttpSecurityScheme({
    scheme: 'bearer'
  })

  const mockDoc = createMockDocument({
    'bearer': httpScheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: { 'bearer': [] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  // resolve() returns self for non-ref schemes
  assertEquals(schemes.length, 1)
  assertStrictEquals(schemes[0], httpScheme)
})

Deno.test('OasSecurityRequirement - toJsonSchema() with single scheme and empty scopes', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: { 'api_key': [] }
  }, mockDoc)

  const jsonSchema = securityReq.toJsonSchema()

  assertEquals(jsonSchema, { 'api_key': [] })
})

Deno.test('OasSecurityRequirement - toJsonSchema() with single scheme and multiple scopes', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: { 'oauth2': ['read:users', 'write:users'] }
  }, mockDoc)

  const jsonSchema = securityReq.toJsonSchema()

  assertEquals(jsonSchema, { 'oauth2': ['read:users', 'write:users'] })
})

Deno.test('OasSecurityRequirement - toJsonSchema() with multiple schemes', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: {
      'api_key': [],
      'oauth2': ['read', 'write'],
      'bearer': []
    }
  }, mockDoc)

  const jsonSchema = securityReq.toJsonSchema()

  assertEquals(jsonSchema, {
    'api_key': [],
    'oauth2': ['read', 'write'],
    'bearer': []
  })
})

Deno.test('OasSecurityRequirement - toJsonSchema() with empty requirement', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: {}
  }, mockDoc)

  const jsonSchema = securityReq.toJsonSchema()

  assertEquals(jsonSchema, {})
  assertEquals(Object.keys(jsonSchema).length, 0)
})

Deno.test('OasSecurityRequirement - toJsonSchema() returns correct OpenAPI v3 structure', () => {
  const mockDoc = createMockDocument()
  const requirement = { 'petstore_auth': ['write:pets', 'read:pets'] }
  const securityReq = new OasSecurityRequirement({ requirement }, mockDoc)

  const jsonSchema = securityReq.toJsonSchema()

  // Should be a plain object matching OpenAPIV3.SecurityRequirementObject
  assertEquals(typeof jsonSchema, 'object')
  assertEquals(Array.isArray(jsonSchema), false)
  assertEquals(jsonSchema, requirement)
})

Deno.test('OasSecurityRequirement - integration with OasHttpSecurityScheme (bearer)', () => {
  const bearerScheme = new OasHttpSecurityScheme({
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT Bearer authentication'
  })

  const mockDoc = createMockDocument({
    'bearer': bearerScheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: { 'bearer': [] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes.length, 1)
  assertEquals(schemes[0].type, 'http')

  const httpScheme = schemes[0] as OasHttpSecurityScheme
  assertEquals(httpScheme.scheme, 'bearer')
  assertEquals(httpScheme.bearerFormat, 'JWT')
})

Deno.test('OasSecurityRequirement - integration with OasApiKeySecurityScheme (header)', () => {
  const apiKeyScheme = new OasApiKeySecurityScheme({
    name: 'X-API-Key',
    in: 'header',
    description: 'API key in header'
  })

  const mockDoc = createMockDocument({
    'api_key': apiKeyScheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: { 'api_key': [] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes.length, 1)
  assertEquals(schemes[0].type, 'apiKey')

  const apiKeySchemeResult = schemes[0] as OasApiKeySecurityScheme
  assertEquals(apiKeySchemeResult.name, 'X-API-Key')
  assertEquals(apiKeySchemeResult.location, 'header')
})

Deno.test('OasSecurityRequirement - integration with OasOAuth2SecurityScheme with scopes', () => {
  const oauth2Scheme = new OasOAuth2SecurityScheme({
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        scopes: {
          'read:users': 'Read user data',
          'write:users': 'Write user data',
          'delete:users': 'Delete user data'
        }
      }
    }
  })

  const mockDoc = createMockDocument({
    'oauth2': oauth2Scheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: { 'oauth2': ['read:users', 'write:users'] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()
  const jsonSchema = securityReq.toJsonSchema()

  assertEquals(schemes.length, 1)
  assertEquals(schemes[0].type, 'oauth2')
  assertEquals(jsonSchema, { 'oauth2': ['read:users', 'write:users'] })
})

Deno.test('OasSecurityRequirement - integration with OasOpenIdSecurityScheme', () => {
  const openIdScheme = new OasOpenIdSecurityScheme({
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration',
    description: 'OpenID Connect'
  })

  const mockDoc = createMockDocument({
    'openid': openIdScheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: { 'openid': [] }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes.length, 1)
  assertEquals(schemes[0].type, 'openIdConnect')

  const openIdSchemeResult = schemes[0] as OasOpenIdSecurityScheme
  assertEquals(openIdSchemeResult.openIdConnectUrl, 'https://example.com/.well-known/openid-configuration')
})

Deno.test('OasSecurityRequirement - integration with all security scheme types', () => {
  const httpScheme = new OasHttpSecurityScheme({ scheme: 'basic' })
  const apiKeyScheme = new OasApiKeySecurityScheme({ name: 'api_key', in: 'query' })
  const oauth2Scheme = new OasOAuth2SecurityScheme({
    flows: {
      clientCredentials: {
        tokenUrl: 'https://example.com/token',
        scopes: {}
      }
    }
  })
  const openIdScheme = new OasOpenIdSecurityScheme({
    openIdConnectUrl: 'https://example.com/.well-known/openid-configuration'
  })

  const mockDoc = createMockDocument({
    'basic': httpScheme,
    'api_key': apiKeyScheme,
    'oauth2': oauth2Scheme,
    'openid': openIdScheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: {
      'basic': [],
      'api_key': [],
      'oauth2': ['admin'],
      'openid': []
    }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  assertEquals(schemes.length, 4)
  assertEquals(schemes[0].type, 'http')
  assertEquals(schemes[1].type, 'apiKey')
  assertEquals(schemes[2].type, 'oauth2')
  assertEquals(schemes[3].type, 'openIdConnect')
})

Deno.test('OasSecurityRequirement - empty requirement represents no authentication', () => {
  const mockDoc = createMockDocument()
  const securityReq = new OasSecurityRequirement({
    requirement: {}
  }, mockDoc)

  assertEquals(securityReq.requirement, {})
  assertEquals(securityReq.toSecurityScheme(), [])
  assertEquals(securityReq.toJsonSchema(), {})
})

Deno.test('OasSecurityRequirement - OAuth2 with empty scopes array', () => {
  const oauth2Scheme = new OasOAuth2SecurityScheme({
    flows: {
      clientCredentials: {
        tokenUrl: 'https://example.com/token',
        scopes: {
          'read': 'Read access',
          'write': 'Write access'
        }
      }
    }
  })

  const mockDoc = createMockDocument({
    'oauth2': oauth2Scheme
  })

  // Empty scopes array means access without specific scopes
  const securityReq = new OasSecurityRequirement({
    requirement: { 'oauth2': [] }
  }, mockDoc)

  assertEquals(securityReq.requirement, { 'oauth2': [] })
  assertEquals(securityReq.toJsonSchema(), { 'oauth2': [] })
})

Deno.test('OasSecurityRequirement - API key with empty scopes (standard pattern)', () => {
  const apiKeyScheme = new OasApiKeySecurityScheme({
    name: 'X-API-Key',
    in: 'header'
  })

  const mockDoc = createMockDocument({
    'api_key': apiKeyScheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: { 'api_key': [] }
  }, mockDoc)

  // API key schemes always have empty scopes
  assertEquals(securityReq.requirement, { 'api_key': [] })
  assertEquals(securityReq.toJsonSchema(), { 'api_key': [] })
  assertEquals(securityReq.toSecurityScheme().length, 1)
})

Deno.test('OasSecurityRequirement - complex OAuth2 scopes scenario', () => {
  const oauth2Scheme = new OasOAuth2SecurityScheme({
    flows: {
      authorizationCode: {
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        scopes: {
          'read:users': 'Read users',
          'write:users': 'Write users',
          'read:posts': 'Read posts',
          'write:posts': 'Write posts',
          'admin': 'Admin access'
        }
      }
    }
  })

  const mockDoc = createMockDocument({
    'petstore_auth': oauth2Scheme
  })

  const securityReq = new OasSecurityRequirement({
    requirement: {
      'petstore_auth': ['write:posts', 'read:posts']
    }
  }, mockDoc)

  assertEquals(securityReq.requirement, {
    'petstore_auth': ['write:posts', 'read:posts']
  })
  assertEquals(securityReq.toJsonSchema(), {
    'petstore_auth': ['write:posts', 'read:posts']
  })
})

Deno.test('OasSecurityRequirement - preserves scope order', () => {
  const mockDoc = createMockDocument()
  const scopes = ['scope1', 'scope2', 'scope3', 'scope4', 'scope5']
  const securityReq = new OasSecurityRequirement({
    requirement: { 'oauth2': scopes }
  }, mockDoc)

  assertEquals(securityReq.requirement['oauth2'], scopes)
  assertEquals(securityReq.toJsonSchema()['oauth2'], scopes)
})

Deno.test('OasSecurityRequirement - toJsonSchema() creates new object (not reference)', () => {
  const mockDoc = createMockDocument()
  const requirement = { 'api_key': [] }
  const securityReq = new OasSecurityRequirement({ requirement }, mockDoc)

  const jsonSchema1 = securityReq.toJsonSchema()
  const jsonSchema2 = securityReq.toJsonSchema()

  // Should be different objects
  assertEquals(jsonSchema1 !== jsonSchema2, true)
  // But with same content
  assertEquals(jsonSchema1, jsonSchema2)
})

Deno.test('OasSecurityRequirement - scheme names are case-sensitive', () => {
  const scheme1 = new OasApiKeySecurityScheme({ name: 'key1', in: 'header' })
  const scheme2 = new OasApiKeySecurityScheme({ name: 'key2', in: 'header' })

  const mockDoc = createMockDocument({
    'ApiKey': scheme1,
    'apikey': scheme2
  })

  const securityReq = new OasSecurityRequirement({
    requirement: {
      'ApiKey': [],
      'apikey': []
    }
  }, mockDoc)

  const schemes = securityReq.toSecurityScheme()

  // Should find both schemes (case-sensitive matching)
  assertEquals(schemes.length, 2)
})
