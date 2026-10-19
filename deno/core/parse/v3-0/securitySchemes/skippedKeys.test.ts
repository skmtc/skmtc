import { assertEquals } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'
import {
  OasApiKeySecurityScheme,
  OasOAuth2SecurityScheme
} from '@/oas/securitySchemes/SecurityScheme.ts'
import { toSecuritySchemesV3 } from '@/parse/v3-0/securitySchemes/toSecuritySchemes.ts'

const parseSecuritySchemes = (securitySchemes: unknown) => {
  const documentObject = toDocumentObject(
    {
      openapi: '3.0.3',
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

Deno.test('v3-0 security schemes - unknown keys warn and stay off the IR', () => {
  const { result, issues } = parseSecuritySchemes({
    legacyKey: {
      type: 'apiKey',
      name: 'key',
      in: 'header',
      deprecated: true,
      'x-internal': true
    },
    oauth: {
      type: 'oauth2',
      oauth2MetadataUrl: 'https://example.com/.well-known/oauth-authorization-server',
      flows: {
        implicit: { authorizationUrl: 'https://example.com/authorize', scopes: {} },
        deviceAuthorization: {
          deviceAuthorizationUrl: 'https://example.com/device',
          tokenUrl: 'https://example.com/token'
        }
      }
    }
  })

  assertEquals(issues, [
    { level: 'warning', type: 'UNEXPECTED_PROPERTY', location: 'TEST:legacyKey:deprecated' },
    { level: 'warning', type: 'UNEXPECTED_PROPERTY', location: 'TEST:oauth:oauth2MetadataUrl' },
    {
      level: 'warning',
      type: 'UNEXPECTED_PROPERTY',
      location: 'TEST:oauth:flows:deviceAuthorization'
    }
  ])

  assertEquals(result, {
    legacyKey: new OasApiKeySecurityScheme({ name: 'key', in: 'header' }),
    oauth: new OasOAuth2SecurityScheme({
      flows: {
        implicit: { authorizationUrl: 'https://example.com/authorize', scopes: {} }
      }
    })
  })
})
