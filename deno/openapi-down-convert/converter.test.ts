// Converted OpenAPI documents are navigated structurally in the assertions
// below, so a permissive shape keeps the tests readable.
// deno-lint-ignore-file no-explicit-any

import {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from '@std/assert'
import { parse as parseYaml } from '@std/yaml/parse'
import { Converter, type ConverterOptions } from './converter.ts'

// The converter narrates transformations to stderr in verbose mode; silence
// that diagnostic output so the test run stays readable.
console.warn = () => {}
console.error = () => {}

const scopeDescriptions = parseYaml(
  Deno.readTextFileSync(new URL('./fixtures/scopes.yaml', import.meta.url)),
) as Record<string, string>

Deno.test('Converter - changes openapi 3.1.x to 3.0.x', () => {
  const converted = new Converter({ openapi: '3.1.0' }).convert() as any
  assertEquals(converted.openapi, '3.0.3')
})

Deno.test('Converter - $ref keeps siblings by default, becomes allOf with allOfTransform', () => {
  const input = {
    components: {
      schemas: {
        a: { type: 'string' },
        b: {
          description: 'a B string based on components/schemas/a',
          title: 'a B string',
          $ref: '#/components/schemas/a',
        },
      },
    },
  }

  // Default: allOfTransform = false.
  {
    const converted = new Converter(input).convert() as any
    const b = converted.components.schemas.b
    assertEquals(b.$ref, '#/components/schemas/a')
    assertEquals(b.title, 'a B string')
    assertEquals(b.description, 'a B string based on components/schemas/a')
  }

  // allOfTransform = true.
  {
    const converted = new Converter(input, { allOfTransform: true }).convert() as any
    const b = converted.components.schemas.b
    assertEquals(b.$ref, undefined)
    assertExists(b.allOf)
    assertEquals(b.allOf[0].$ref, '#/components/schemas/a')
  }
})

Deno.test('Converter - non-schema $ref with siblings is simplified to a JSON Reference', () => {
  const input = {
    paths: {
      '/things/{thingId}': {
        get: {
          parameters: [
            { description: 'a thing', $ref: '#/components/parameters/thingIdPathParam' },
          ],
        },
      },
      components: {
        parameters: {
          thingIdPathParam: { in: 'path', type: 'string' },
        },
      },
    },
  }
  const converted = new Converter(input).convert() as any
  const getParam0 = converted.paths['/things/{thingId}'].get.parameters[0]
  assertExists(getParam0.$ref)
  assertEquals(getParam0.description, undefined)
})

Deno.test('Converter - converts openIdConnect security schemes to oauth2', () => {
  const input = {
    paths: {
      '/things/{thingId}': {
        get: {
          security: [
            { accessToken1: ['thing/read', 'profile/read'], apiKey: [] },
            { accessToken2: ['foo/read'] },
          ],
        },
        put: {
          security: [
            { accessToken1: ['thing/write', 'profile/write'], apiKey: [] },
            { accessToken2: ['foo/write'] },
          ],
        },
      },
    },
    components: {
      securitySchemes: {
        accessToken1: {
          type: 'openIdConnect',
          description: 'OpenID Connect #1 - Authorization Code Flow',
          openIdConnectUrl: 'https://www.example.com/oidc-1/.well-known/openid-configuration',
        },
        accessToken2: {
          type: 'openIdConnect',
          description: 'OpenID Connect #2 - Authorization Code Flow',
          openIdConnectUrl: 'https://www.example.com/oidc-2/.well-known/openid-configuration',
        },
      },
    },
  }
  const options: ConverterOptions = {
    authorizationUrl: 'https://www.example.com/test/authorize',
    tokenUrl: 'https://www.example.com/test/token',
    scopeDescriptions,
    convertOpenIdConnectToOAuth2: true,
  }
  const converted = new Converter(input, options).convert() as any

  {
    const accessToken1 = converted.components.securitySchemes.accessToken1
    assertExists(accessToken1)
    assertEquals(accessToken1.type, 'oauth2')
    assertStringIncludes(
      accessToken1.description,
      'https://www.example.com/oidc-1/.well-known/openid-configuration',
    )
    const scopes1 = accessToken1.flows.authorizationCode.scopes
    assertExists(scopes1)
    assertEquals(Object.keys(scopes1).length, 4)
    assert(scopes1['thing/read'])
    assert(scopes1['thing/write'])
    assert(scopes1['profile/read'])
    assert(scopes1['profile/write'])
    const flow1 = accessToken1.flows.authorizationCode
    assertEquals(flow1.authorizationUrl, options.authorizationUrl)
    assertEquals(flow1.tokenUrl, options.tokenUrl)
  }

  {
    const accessToken2 = converted.components.securitySchemes.accessToken2
    assertExists(accessToken2)
    assertEquals(accessToken2.type, 'oauth2')
    assertStringIncludes(
      accessToken2.description,
      'https://www.example.com/oidc-2/.well-known/openid-configuration',
    )
    const scopes2 = accessToken2.flows.authorizationCode.scopes
    assertExists(scopes2)
    assertEquals(Object.keys(scopes2).length, 2)
    assert(scopes2['foo/read'])
    assert(scopes2['foo/write'])
    const flow2 = accessToken2.flows.authorizationCode
    assertEquals(flow2.authorizationUrl, options.authorizationUrl)
    assertEquals(flow2.tokenUrl, options.tokenUrl)
  }
})

Deno.test('Converter - replaces schema examples with a single example', () => {
  const input = {
    components: {
      schemas: {
        a: { type: 'string', examples: ['foo', 'bar'] },
        b: {
          type: 'object',
          properties: {
            c: { type: 'string', examples: ['a', 'b'] },
            d: { type: 'object', examples: [{ id: 'a', x: 'b' }] },
          },
        },
      },
    },
  }
  const converted = new Converter(input, {
    allOfTransform: true,
    deleteExampleWithId: true,
  }).convert() as any

  const a = converted.components.schemas.a
  assertEquals(a.examples, undefined)
  assertEquals(a.example, 'foo')

  const c = converted.components.schemas.b.properties.c
  assertEquals(c.examples, undefined)
  assertEquals(c.example, 'a')

  const d = converted.components.schemas.b.properties.d
  assertFalse(Object.hasOwn(d, 'examples'))
  assertFalse(Object.hasOwn(d, 'example'))
})

Deno.test('Converter - issue #37: property description preserved alongside description/$ref', () => {
  const input = {
    components: {
      schemas: {
        x: {
          title: 'X',
          description: 'X (schema)',
          type: 'string',
          minLength: 0,
          maxLength: 16,
        },
        thing: {
          title: 'Thing',
          description: 'A thing',
          type: 'object',
          properties: {
            x: { description: 'x (property)', $ref: '#/components/schemas/x' },
          },
        },
      },
    },
  }
  const expected = {
    x: {
      title: 'X',
      description: 'X (schema)',
      type: 'string',
      minLength: 0,
      maxLength: 16,
    },
    thing: {
      title: 'Thing',
      description: 'A thing',
      type: 'object',
      properties: {
        x: {
          description: 'x (property)',
          allOf: [{ $ref: '#/components/schemas/x' }],
        },
      },
    },
  }
  const converted = new Converter(input, {
    allOfTransform: true,
    deleteExampleWithId: true,
  }).convert() as any
  assertEquals(converted.components.schemas, expected)
})

Deno.test('Converter - resolves $ref schema examples to a single example', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        a: { type: 'string', examples: ['foo', 'bar'] },
        b: {
          description: 'a B string based on components/schemas/a',
          title: 'a B string',
          $ref: '#/components/schemas/a',
          examples: ['Foo', 'Bar'],
        },
      },
    },
  }
  const converted = new Converter(input, { allOfTransform: true }).convert() as any

  const a = converted.components.schemas.a
  assertEquals(a.examples, undefined)
  assertEquals(a.example, 'foo')

  const b = converted.components.schemas.b
  assertEquals(b.examples, undefined)
  assertEquals(b.example, 'Foo')
})

Deno.test('Converter - removes $id and $schema keywords', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        a: {
          $id: 'http://www.example.com/schemas/a',
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'string',
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: { schemas: { a: { type: 'string' } } },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - converts schema $comment to x-comment when requested', () => {
  const input = {
    components: {
      schemas: {
        a: { type: 'string', $comment: 'This is a comment.' },
      },
    },
  }
  const converted = new Converter(input, { convertSchemaComments: true }).convert() as any

  const a = converted.components.schemas.a
  assertEquals(a.$comment, undefined)
  assertEquals(a['x-comment'], 'This is a comment.')
})

Deno.test('Converter - removes unevaluatedProperties keywords', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        a: {
          type: 'object',
          unevaluatedProperties: false,
          properties: {
            b: {
              type: 'object',
              unevaluatedProperties: false,
              properties: { s: { type: 'string' } },
            },
          },
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        a: {
          type: 'object',
          properties: {
            b: { type: 'object', properties: { s: { type: 'string' } } },
          },
        },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - removes patternProperties keywords', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        a: {
          type: 'object',
          properties: { s: { type: 'string' } },
          patternProperties: {
            '^[a-z{2}-[A-Z]{2,3}]$': {
              type: 'object',
              unevaluatedProperties: false,
              properties: { t: { type: 'string' } },
            },
          },
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        a: { type: 'object', properties: { s: { type: 'string' } } },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - removes propertyNames keywords', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        a: {
          type: 'object',
          propertyNames: { pattern: '^[A-Za-z_][A-Za-z0-9_]*$' },
          additionalProperties: { type: 'string' },
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        a: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - removes contentMediaType keywords', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        a: {
          type: 'object',
          unevaluatedProperties: false,
          properties: {
            b: { type: 'string', contentMediaType: 'application/pdf', maxLength: 5000000 },
          },
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        a: {
          type: 'object',
          properties: { b: { type: 'string', maxLength: 5000000 } },
        },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - removes the webhooks object', () => {
  const input = {
    openapi: '3.1.0',
    webhooks: {
      newThing: {
        post: {
          requestBody: {
            description: 'Information about a new thing in the system',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/newThing' },
              },
            },
          },
          responses: {
            200: { description: 'Return a 200 status to indicate success' },
          },
        },
      },
    },
  }
  const expected = { openapi: '3.0.3' }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - renames $comment to x-comment when requested', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        a: {
          type: 'object',
          $comment: 'a comment on schema a',
          properties: {
            b: {
              type: 'object',
              $comment: 'A comment on a.b',
              properties: {
                s: { type: 'string', $comment: 'A comment on a.b.s' },
              },
            },
          },
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        a: {
          type: 'object',
          'x-comment': 'a comment on schema a',
          properties: {
            b: {
              type: 'object',
              'x-comment': 'A comment on a.b',
              properties: {
                s: { type: 'string', 'x-comment': 'A comment on a.b.s' },
              },
            },
          },
        },
      },
    },
  }
  const converted = new Converter(input, {
    verbose: true,
    convertSchemaComments: true,
  }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - deletes $comment by default', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        a: {
          type: 'object',
          $comment: 'a comment on schema a',
          properties: {
            b: {
              type: 'object',
              $comment: 'A comment on a.b',
              properties: {
                s: { type: 'string', $comment: 'A comment on a.b.s' },
              },
            },
          },
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        a: {
          type: 'object',
          properties: {
            b: { type: 'object', properties: { s: { type: 'string' } } },
          },
        },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - converts a nullable type array to nullable: true', () => {
  const input = {
    components: { schemas: { a: { type: ['string', 'null'] } } },
  }
  const expected = {
    openapi: '3.0.3',
    components: { schemas: { a: { type: 'string', nullable: true } } },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

// OpenAPI 3.1 encodes a nullable $ref as a oneOf/anyOf with a `{type: 'null'}`
// member (3.0's `nullable` does not exist in 3.1, and `type: 'null'` cannot be
// placed on the $ref itself). 3.0 has no null type, so the down-convert must
// fold the null member away: remove it and set `nullable: true` on the
// wrapper. The single-member-group + sibling `nullable` form is the 3.0
// encoding for "nullable reference" (a sibling directly on a $ref would be
// ignored).
Deno.test('Converter - folds a null oneOf member into nullable: true', () => {
  const input = {
    components: {
      schemas: {
        maybeUser: {
          oneOf: [{ $ref: '#/components/schemas/user' }, { type: 'null' }],
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        maybeUser: {
          oneOf: [{ $ref: '#/components/schemas/user' }],
          nullable: true,
        },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - folds a null anyOf member into nullable: true, keeping remaining members', () => {
  const input = {
    components: {
      schemas: {
        maybeId: {
          anyOf: [{ $ref: '#/components/schemas/id' }, { type: 'string' }, { type: 'null' }],
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        maybeId: {
          anyOf: [{ $ref: '#/components/schemas/id' }, { type: 'string' }],
          nullable: true,
        },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - folds an enum-of-null union member into nullable: true', () => {
  const input = {
    components: {
      schemas: {
        maybeUser: {
          oneOf: [{ $ref: '#/components/schemas/user' }, { enum: [null] }],
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        maybeUser: {
          oneOf: [{ $ref: '#/components/schemas/user' }],
          nullable: true,
        },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - folds null union members in nested schemas', () => {
  const input = {
    components: {
      schemas: {
        account: {
          type: 'object',
          properties: {
            owner: {
              anyOf: [{ $ref: '#/components/schemas/user' }, { type: 'null' }],
            },
          },
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        account: {
          type: 'object',
          properties: {
            owner: {
              anyOf: [{ $ref: '#/components/schemas/user' }],
              nullable: true,
            },
          },
        },
      },
    },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - throws when a union contains only null members', () => {
  const input = {
    components: {
      schemas: {
        alwaysNull: { oneOf: [{ type: 'null' }] },
      },
    },
  }
  assertThrows(
    () => new Converter(input).convert(),
    Error,
    'Cannot down convert this OpenAPI definition.',
  )
})

Deno.test('Converter - converts const to a single-value enum, including nested schemas', () => {
  const input = {
    components: {
      schemas: {
        version: { type: 'string', const: '1.0.0' },
        nested: {
          type: 'object',
          properties: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  type: { const: 's' },
                  value: { type: 'string' },
                },
              },
              {
                type: 'object',
                properties: {
                  type: { const: 'n' },
                  value: { type: 'number' },
                },
              },
            ],
          },
        },
      },
    },
  }
  const expected = {
    version: { type: 'string', enum: ['1.0.0'] },
    nested: {
      type: 'object',
      properties: {
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { enum: ['s'] },
              value: { type: 'string' },
            },
          },
          {
            type: 'object',
            properties: {
              type: { enum: ['n'] },
              value: { type: 'number' },
            },
          },
        ],
      },
    },
  }
  const converted = new Converter(input, { allOfTransform: true }).convert() as any
  assertEquals(converted.components.schemas, expected)
})

Deno.test('Converter - removes info.license.identifier', () => {
  const input = {
    openapi: '3.1.0',
    info: { license: { name: 'MIT', identifier: 'MIT' } },
  }
  const expected = {
    openapi: '3.0.3',
    info: { license: { name: 'MIT' } },
  }
  const converted = new Converter(input, { verbose: true }).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - converts the larger example document', () => {
  const source = Deno.readTextFileSync(new URL('./fixtures/openapi.yaml', import.meta.url))
  const input = parseYaml(source) as object
  assertExists(input)

  const options: ConverterOptions = {
    verbose: true,
    deleteExampleWithId: true,
    scopeDescriptions,
  }
  const converted = new Converter(input, options).convert() as any

  const appIdPathParam = converted.components.parameters.appIdPathParam
  assertEquals(
    Object.keys(appIdPathParam).sort(),
    ['name', 'description', 'in', 'required', 'schema'].sort(),
  )

  const scopes = converted.components.securitySchemes.accessToken.flows.authorizationCode.scopes
  assertEquals(scopes['scope1'], 'Allow the application to access your personal profile data.')
  assertEquals(scopes['scope3'], `TODO: describe the 'scope3' scope`)

  const publicOp = converted.paths['/users/{appId}/public-preferences'].get
  assertFalse(publicOp.security)
})

Deno.test('Converter - throws on contentEncoding base64 with a conflicting format', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithExistingBinaryFormat: {
          type: 'string',
          format: 'binary',
          contentEncoding: 'base64',
        },
      },
    },
  }
  assertThrows(() => new Converter(input).convert())
})

Deno.test('Converter - keeps format: byte when contentEncoding base64 agrees', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithByteFormat: {
          type: 'string',
          format: 'byte',
          contentEncoding: 'base64',
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        binaryEncodedDataWithByteFormat: { type: 'string', format: 'byte' },
      },
    },
  }
  const converted = new Converter(input).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - converts contentEncoding base64 to format: byte', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithNoFormat: { type: 'string', contentEncoding: 'base64' },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        binaryEncodedDataWithNoFormat: { type: 'string', format: 'byte' },
      },
    },
  }
  const converted = new Converter(input).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - keeps format: binary when contentMediaType agrees', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryData: {
          type: 'string',
          contentMediaType: 'application/octet-stream',
          format: 'binary',
        },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        binaryData: { type: 'string', format: 'binary' },
      },
    },
  }
  const converted = new Converter(input).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - converts contentMediaType octet-stream to format: binary', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryData: { type: 'string', contentMediaType: 'application/octet-stream' },
      },
    },
  }
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        binaryData: { type: 'string', format: 'binary' },
      },
    },
  }
  const converted = new Converter(input).convert() as any
  assertEquals(converted, expected)
})

Deno.test('Converter - throws on contentMediaType octet-stream with a conflicting format', () => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryData: {
          type: 'string',
          contentMediaType: 'application/octet-stream',
          format: 'byte',
        },
      },
    },
  }
  assertThrows(() => new Converter(input).convert())
})
