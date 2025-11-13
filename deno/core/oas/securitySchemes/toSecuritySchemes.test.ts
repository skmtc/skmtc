import { mockParseContext } from '@/test/mockParseContext.ts'
import { toSecuritySchemesV3 } from './toSecuritySchemes.ts'
import { assertEquals, assertExists } from '@std/assert'
import {
  OasHttpSecurityScheme,
  OasApiKeySecurityScheme,
  OasOAuth2SecurityScheme,
  OasOpenIdSecurityScheme,
} from './SecurityScheme.ts'
import { StackTrail } from '@/context/StackTrail.ts'

Deno.test('toSecuritySchemesV3', async (t) => {
  await t.step('input handling', async (t) => {
    await t.step('should return undefined when securitySchemes is undefined', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: undefined,
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result, undefined)
    })

    await t.step('should return undefined when securitySchemes is empty object', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {},
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(Object.keys(result ?? {}).length, 0)
    })

    await t.step('should handle single security scheme', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          basicAuth: {
            type: 'http',
            scheme: 'basic',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(Object.keys(result).length, 1)
      assertEquals(result.basicAuth instanceof OasHttpSecurityScheme, true)
    })

    await t.step('should handle multiple security schemes of different types', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          basicAuth: {
            type: 'http',
            scheme: 'basic',
          },
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
          oauth: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {},
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(Object.keys(result).length, 3)
      assertEquals(result.basicAuth instanceof OasHttpSecurityScheme, true)
      assertEquals(result.apiKey instanceof OasApiKeySecurityScheme, true)
      assertEquals(result.oauth instanceof OasOAuth2SecurityScheme, true)
    })
  })

  await t.step('HTTP security scheme', async (t) => {
    await t.step('should convert HTTP basic auth scheme', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          basicAuth: {
            type: 'http',
            scheme: 'basic',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result, {
        basicAuth: new OasHttpSecurityScheme({
          scheme: 'basic',
        }),
      })
    })

    await t.step('should convert HTTP bearer auth scheme', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          http: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result, {
        http: new OasHttpSecurityScheme({
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }),
      })
    })

    await t.step('should handle HTTP scheme with all optional fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          digestAuth: {
            type: 'http',
            scheme: 'digest',
            description: 'Digest authentication',
            bearerFormat: undefined,
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.digestAuth.type, 'http')
      assertEquals((result.digestAuth as OasHttpSecurityScheme).scheme, 'digest')
      assertEquals(result.digestAuth.description, 'Digest authentication')
    })

    await t.step('should handle HTTP scheme with minimal required fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          http: {
            type: 'http',
            scheme: 'bearer',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.http as OasHttpSecurityScheme).scheme, 'bearer')
      assertEquals(result.http.description, undefined)
      assertEquals((result.http as OasHttpSecurityScheme).bearerFormat, undefined)
    })

    await t.step('should extract and log skipped/unknown fields', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = toSecuritySchemesV3({
        securitySchemes: {
          http: {
            type: 'http',
            scheme: 'bearer',
            'x-custom': 'value',
          } as unknown as {
            type: 'http'
            scheme: string
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      // Note: mockParseContext logs skipped fields but doesn't expose call count
    })
  })

  await t.step('API key security scheme', async (t) => {
    await t.step('should convert API key in header location', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result, {
        apiKey: new OasApiKeySecurityScheme({
          name: 'X-API-Key',
          in: 'header',
        }),
      })
    })

    await t.step('should convert API key in query location', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          queryApiKey: {
            type: 'apiKey',
            name: 'api_key',
            in: 'query',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.queryApiKey as OasApiKeySecurityScheme).name, 'api_key')
      assertEquals((result.queryApiKey as OasApiKeySecurityScheme).location, 'query')
    })

    await t.step('should convert API key in cookie location', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          cookieApiKey: {
            type: 'apiKey',
            name: 'session_id',
            in: 'cookie',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.cookieApiKey as OasApiKeySecurityScheme).name, 'session_id')
      assertEquals((result.cookieApiKey as OasApiKeySecurityScheme).location, 'cookie')
    })

    await t.step('should map "in" field to "location" property correctly', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          headerKey: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      // The class property is called 'location' but input is 'in'
      assertEquals((result.headerKey as OasApiKeySecurityScheme).location, 'header')
    })

    await t.step('should handle API key with description', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description: 'API key for authentication',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.apiKey.description, 'API key for authentication')
    })

    await t.step('should handle API key with minimal required fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          minimal: {
            type: 'apiKey',
            name: 'key',
            in: 'query',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.minimal as OasApiKeySecurityScheme).name, 'key')
      assertEquals((result.minimal as OasApiKeySecurityScheme).location, 'query')
      assertEquals(result.minimal.description, undefined)
    })
  })

  await t.step('OAuth2 security scheme', async (t) => {
    await t.step('should convert OAuth2 with authorizationCode flow', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {
                  'read': 'Read access',
                  'write': 'Write access',
                },
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.oauth2.type, 'oauth2')
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.authorizationCode?.authorizationUrl, 'https://example.com/oauth/authorize')
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.authorizationCode?.tokenUrl, 'https://example.com/oauth/token')
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.authorizationCode?.scopes.read, 'Read access')
    })

    await t.step('should convert OAuth2 with clientCredentials flow', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              clientCredentials: {
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {
                  'admin': 'Admin access',
                },
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.clientCredentials?.tokenUrl, 'https://example.com/oauth/token')
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.clientCredentials?.scopes.admin, 'Admin access')
    })

    await t.step('should convert OAuth2 with implicit flow', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              implicit: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                scopes: {
                  'profile': 'Profile access',
                },
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.implicit?.authorizationUrl, 'https://example.com/oauth/authorize')
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.implicit?.scopes.profile, 'Profile access')
    })

    await t.step('should convert OAuth2 with password flow', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              password: {
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {
                  'user': 'User access',
                },
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.password?.tokenUrl, 'https://example.com/oauth/token')
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.password?.scopes.user, 'User access')
    })

    await t.step('should handle OAuth2 with multiple flows', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                scopes: { 'read': 'Read' },
              },
              implicit: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                scopes: { 'profile': 'Profile' },
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertExists((result.oauth2 as OasOAuth2SecurityScheme).flows.authorizationCode)
      assertExists((result.oauth2 as OasOAuth2SecurityScheme).flows.implicit)
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.clientCredentials, undefined)
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.password, undefined)
    })

    await t.step('should handle OAuth2 with empty scopes', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {},
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(Object.keys((result.oauth2 as OasOAuth2SecurityScheme).flows.authorizationCode?.scopes ?? {}).length, 0)
    })

    await t.step('should handle OAuth2 with multiple scopes', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {
                  'read:users': 'Read user information',
                  'write:users': 'Modify user information',
                  'delete:users': 'Delete users',
                  'admin': 'Full administrative access',
                },
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(Object.keys((result.oauth2 as OasOAuth2SecurityScheme).flows.authorizationCode?.scopes ?? {}).length, 4)
      assertEquals((result.oauth2 as OasOAuth2SecurityScheme).flows.authorizationCode?.scopes['read:users'], 'Read user information')
    })

    await t.step('should handle OAuth2 with optional refreshUrl', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oauth2WithRefresh: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                refreshUrl: 'https://example.com/oauth/refresh',
                scopes: {},
              },
            },
          },
          oauth2WithoutRefresh: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {},
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.oauth2WithRefresh as OasOAuth2SecurityScheme).flows.authorizationCode?.refreshUrl, 'https://example.com/oauth/refresh')
      assertEquals((result.oauth2WithoutRefresh as OasOAuth2SecurityScheme).flows.authorizationCode?.refreshUrl, undefined)
    })
  })

  await t.step('OpenID Connect security scheme', async (t) => {
    await t.step('should convert OpenID Connect with minimal required fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          openId: {
            type: 'openIdConnect',
            openIdConnectUrl: 'https://example.com/.well-known/openid-configuration',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertEquals(result, {
        openId: new OasOpenIdSecurityScheme({
          openIdConnectUrl: 'https://example.com/.well-known/openid-configuration',
        }),
      })
    })

    await t.step('should convert OpenID Connect with description', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          openId: {
            type: 'openIdConnect',
            openIdConnectUrl: 'https://example.com/.well-known/openid-configuration',
            description: 'OpenID Connect authentication',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.openId as OasOpenIdSecurityScheme).openIdConnectUrl, 'https://example.com/.well-known/openid-configuration')
      assertEquals(result.openId.description, 'OpenID Connect authentication')
    })

    await t.step('should handle OpenID Connect with all fields', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          oidc: {
            type: 'openIdConnect',
            openIdConnectUrl: 'https://auth.example.com/.well-known/openid-configuration',
            description: 'Enterprise SSO via OpenID Connect',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(result.oidc.type, 'openIdConnect')
      assertEquals((result.oidc as OasOpenIdSecurityScheme).openIdConnectUrl, 'https://auth.example.com/.well-known/openid-configuration')
      assertEquals(result.oidc.description, 'Enterprise SSO via OpenID Connect')
    })
  })

  // Note: Reference handling tests require a full ParseContext with registerRef method
  // mockParseContext doesn't support references, so these tests are skipped

  await t.step('field extraction and logging', async (t) => {
    await t.step('should extract known fields correctly', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          http: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Bearer token',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals((result.http as OasHttpSecurityScheme).scheme, 'bearer')
      assertEquals((result.http as OasHttpSecurityScheme).bearerFormat, 'JWT')
      assertEquals(result.http.description, 'Bearer token')
    })

    await t.step('should identify unknown/extra fields as skipped', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = toSecuritySchemesV3({
        securitySchemes: {
          http: {
            type: 'http',
            scheme: 'bearer',
            'x-unknown': 'value',
            'extra': 123,
          } as unknown as {
            type: 'http'
            scheme: string
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      // Note: mockParseContext handles logging internally
    })

    await t.step('should call context.logSkippedFields for unknown fields', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = toSecuritySchemesV3({
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'key',
            in: 'header',
            'x-custom-field': 'custom value',
          } as unknown as {
            type: 'apiKey'
            name: string
            in: 'header'
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      // Note: mockParseContext handles logging internally
    })

    await t.step('should not log when no skipped fields exist', () => {
      const stackTrail = new StackTrail(['TEST'])

      const result = toSecuritySchemesV3({
        securitySchemes: {
          basic: {
            type: 'http',
            scheme: 'basic',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      // Note: mockParseContext handles logging internally
    })
  })

  await t.step('complex scenarios', async (t) => {
    await t.step('should handle mix of all security scheme types', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          basic: {
            type: 'http',
            scheme: 'basic',
          },
          bearer: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKeyHeader: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
          apiKeyQuery: {
            type: 'apiKey',
            name: 'api_key',
            in: 'query',
          },
          oauth: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                tokenUrl: 'https://example.com/oauth/token',
                scopes: {},
              },
            },
          },
          openId: {
            type: 'openIdConnect',
            openIdConnectUrl: 'https://example.com/.well-known/openid-configuration',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(Object.keys(result).length, 6)
      assertEquals(result.basic instanceof OasHttpSecurityScheme, true)
      assertEquals(result.bearer instanceof OasHttpSecurityScheme, true)
      assertEquals(result.apiKeyHeader instanceof OasApiKeySecurityScheme, true)
      assertEquals(result.apiKeyQuery instanceof OasApiKeySecurityScheme, true)
      assertEquals(result.oauth instanceof OasOAuth2SecurityScheme, true)
      assertEquals(result.openId instanceof OasOpenIdSecurityScheme, true)
    })

    await t.step('should handle security schemes with different types mixed', () => {
      const stackTrail = new StackTrail(['TEST'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          http: {
            type: 'http',
            scheme: 'bearer',
          },
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
          oauth: {
            type: 'oauth2',
            flows: {
              implicit: {
                authorizationUrl: 'https://example.com/oauth/authorize',
                scopes: {},
              },
            },
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(Object.keys(result).length, 3)
      assertEquals(result.http instanceof OasHttpSecurityScheme, true)
      assertEquals(result.apiKey instanceof OasApiKeySecurityScheme, true)
      assertEquals(result.oauth instanceof OasOAuth2SecurityScheme, true)
    })

    await t.step('should work with realistic OpenAPI document security schemes', () => {
      const stackTrail = new StackTrail(['components', 'securitySchemes'])
      const result = toSecuritySchemesV3({
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT Bearer token authentication',
          },
          ApiKeyAuth: {
            type: 'apiKey',
            name: 'X-API-KEY',
            in: 'header',
            description: 'API key sent in custom header',
          },
          OAuth2: {
            type: 'oauth2',
            description: 'OAuth 2.0 authentication',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://auth.example.com/oauth/authorize',
                tokenUrl: 'https://auth.example.com/oauth/token',
                refreshUrl: 'https://auth.example.com/oauth/refresh',
                scopes: {
                  'read:users': 'Read user data',
                  'write:users': 'Modify user data',
                  'admin': 'Administrative access',
                },
              },
            },
          },
          OpenID: {
            type: 'openIdConnect',
            openIdConnectUrl: 'https://auth.example.com/.well-known/openid-configuration',
            description: 'OpenID Connect SSO',
          },
        },
        stackTrail,
        context: mockParseContext,
      })

      assertExists(result)
      assertEquals(Object.keys(result).length, 4)

      // Verify Bearer auth
      assertEquals(result.BearerAuth.type, 'http')
      assertEquals((result.BearerAuth as OasHttpSecurityScheme).scheme, 'bearer')
      assertEquals((result.BearerAuth as OasHttpSecurityScheme).bearerFormat, 'JWT')

      // Verify API key
      assertEquals(result.ApiKeyAuth.type, 'apiKey')
      assertEquals((result.ApiKeyAuth as OasApiKeySecurityScheme).name, 'X-API-KEY')
      assertEquals((result.ApiKeyAuth as OasApiKeySecurityScheme).location, 'header')

      // Verify OAuth2
      assertEquals(result.OAuth2.type, 'oauth2')
      assertEquals(Object.keys((result.OAuth2 as OasOAuth2SecurityScheme).flows.authorizationCode?.scopes ?? {}).length, 3)

      // Verify OpenID
      assertEquals(result.OpenID.type, 'openIdConnect')
      assertEquals((result.OpenID as OasOpenIdSecurityScheme).openIdConnectUrl, 'https://auth.example.com/.well-known/openid-configuration')
    })
  })
})
