import { assertEquals } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'
import {
  OasApiKeySecurityScheme,
  OasHttpSecurityScheme,
  OasOAuth2SecurityScheme,
  OasOpenIdSecurityScheme
} from '@/oas/securitySchemes/SecurityScheme.ts'
import { toSecuritySchemesV3 } from '@/parse/v3-2/securitySchemes/toSecuritySchemes.ts'

const parseSecuritySchemes = (securitySchemes: unknown) => {
  const documentObject = toDocumentObject(
    {
      openapi: '3.2.0',
      info: { title: 't', version: '0' },
      paths: {},
      components: { securitySchemes }
    },
    'security schemes document'
  )
  const context = new ParseContext({
    input: { type: 'oas', value: documentObject },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = toSecuritySchemesV3({
    securitySchemes: documentObject.components?.securitySchemes,
    stackTrail: new StackTrail(['TEST']),
    context
  })

  return {
    result,
    issues: context.issues.map(({ level, type, location }) => ({ level, type, location }))
  }
}

Deno.test('v3-2 security schemes - 3.2 fields are on the IR with no warning', () => {
  const { result, issues } = parseSecuritySchemes({
    basic: { type: 'http', scheme: 'basic', deprecated: true },
    legacyKey: { type: 'apiKey', name: 'key', in: 'header', deprecated: false },
    oidc: {
      type: 'openIdConnect',
      openIdConnectUrl: 'https://example.com/.well-known/openid-configuration',
      deprecated: true
    },
    oauth: {
      type: 'oauth2',
      deprecated: true,
      oauth2MetadataUrl: 'https://example.com/.well-known/oauth-authorization-server',
      flows: {
        // `refreshUrl` and `scopes` are optional on the device flow.
        deviceAuthorization: {
          deviceAuthorizationUrl: 'https://example.com/device',
          tokenUrl: 'https://example.com/token'
        }
      }
    }
  })

  assertEquals(issues, [])
  assertEquals(result, {
    basic: new OasHttpSecurityScheme({ scheme: 'basic', deprecated: true }),
    legacyKey: new OasApiKeySecurityScheme({ name: 'key', in: 'header', deprecated: false }),
    oidc: new OasOpenIdSecurityScheme({
      openIdConnectUrl: 'https://example.com/.well-known/openid-configuration',
      deprecated: true
    }),
    oauth: new OasOAuth2SecurityScheme({
      deprecated: true,
      oauth2MetadataUrl: 'https://example.com/.well-known/oauth-authorization-server',
      flows: {
        deviceAuthorization: {
          deviceAuthorizationUrl: 'https://example.com/device',
          tokenUrl: 'https://example.com/token'
        }
      }
    })
  })
})

Deno.test('v3-2 security schemes - a device flow without tokenUrl drops the scheme', () => {
  const { result, issues } = parseSecuritySchemes({
    oauth: {
      type: 'oauth2',
      flows: { deviceAuthorization: { deviceAuthorizationUrl: 'https://example.com/device' } }
    }
  })

  assertEquals(result, {})
  assertEquals(issues, [
    { level: 'error', type: 'INVALID_SECURITY_SCHEME', location: 'TEST:oauth' }
  ])
})

Deno.test('v3-2 security schemes - keys outside 3.2 still warn', () => {
  const { issues } = parseSecuritySchemes({
    oauth: {
      type: 'oauth2',
      unknownKey: true,
      flows: {
        unknownFlow: {},
        deviceAuthorization: {
          deviceAuthorizationUrl: 'https://example.com/device',
          tokenUrl: 'https://example.com/token'
        }
      }
    }
  })

  assertEquals(issues, [
    { level: 'warning', type: 'UNEXPECTED_PROPERTY', location: 'TEST:oauth:unknownKey' },
    { level: 'warning', type: 'UNEXPECTED_PROPERTY', location: 'TEST:oauth:flows:unknownFlow' }
  ])
})
