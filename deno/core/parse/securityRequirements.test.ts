import { assertEquals } from '@std/assert'
import type { OpenAPIV3 } from 'openapi-types'
import * as log from 'jsr:@std/log@^0.224.0'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentFieldsV3 as toDocumentFieldsV30 } from '@/parse/v3-0/document/toDocumentFieldsV3.ts'
import { toDocumentFieldsV3 as toDocumentFieldsV31 } from '@/parse/v3-1/document/toDocumentFieldsV3.ts'
import { toDocumentFieldsV3 as toDocumentFieldsV32 } from '@/parse/v3-2/document/toDocumentFieldsV3.ts'
import type { WebhooksObject } from '@/parse/v3-1/webhook/toWebhooksV3.ts'

// An operation or webhook whose effective security (its own, else the
// root's) names a scheme that failed to parse or is not defined, or that
// inherits a malformed root `security`, is dropped with one
// INVALID_OPERATION error on its own trail. `security: []` is kept.

type Logged = { type: string; level: string; message: string; location: string }

type DocumentObject = OpenAPIV3.Document & { webhooks?: WebhooksObject }

const trees = [
  { dialect: '3.0', toDocumentFieldsV3: toDocumentFieldsV30 },
  { dialect: '3.1', toDocumentFieldsV3: toDocumentFieldsV31 },
  { dialect: '3.2', toDocumentFieldsV3: toDocumentFieldsV32 }
]

// `apiKey` parses; `broken` fails (an apiKey scheme needs `name` and `in`).
const securitySchemes = {
  apiKey: { type: 'apiKey', name: 'X-Key', in: 'header' },
  broken: { type: 'apiKey' }
}

type Fixture = {
  /** Root `security`; omitted when not given. */
  root?: unknown
  /** Operation name → its own `security` (`undefined` leaves it out). */
  operations: Record<string, unknown>
  /** `components.securitySchemes`; the `apiKey` + `broken` pair when not given. */
  schemes?: Record<string, unknown>
}

// Each operation is `GET /<name>` and webhook `<name>` (POST). The
// documents carry malformed `security` on purpose, so they are built
// from JSON.
const toDocument = (
  { root, operations, schemes = securitySchemes }: Fixture,
  on: 'paths' | 'webhooks'
): DocumentObject => {
  const items = Object.fromEntries(
    Object.entries(operations).map(([name, security]) => [
      on === 'paths' ? `/${name}` : name,
      { [on === 'paths' ? 'get' : 'post']: { operationId: name, security, responses: {} } }
    ])
  )

  return JSON.parse(
    JSON.stringify({
      openapi: '3.0.0',
      info: { title: 't', version: '0' },
      paths: on === 'paths' ? items : {},
      webhooks: on === 'webhooks' ? items : undefined,
      components: { securitySchemes: schemes },
      security: root
    })
  )
}

const toLocation = (name: string, on: 'paths' | 'webhooks') =>
  on === 'paths' ? `paths:/${name}:get` : `webhooks:${name}:post`

const brokenSchemeError: Logged = {
  type: 'INVALID_SECURITY_SCHEME',
  level: 'error',
  message: 'Invalid key: Expected "name" but received undefined',
  location: 'components:securitySchemes:broken'
}

const dropped = (name: string, on: 'paths' | 'webhooks', message: string): Logged => ({
  type: 'INVALID_OPERATION',
  level: 'error',
  message,
  location: toLocation(name, on)
})

const failedMessage = "Requires security scheme 'broken', which failed to parse"
const inheritsMessage =
  'Inherits root security, which is not a list of security requirement objects'

for (const { dialect, toDocumentFieldsV3 } of trees) {
  for (const on of ['paths', 'webhooks'] as const) {
    const parse = (fixture: Fixture) => {
      const context = new ParseContext({
        input: {
          type: 'oas',
          value: { openapi: '3.0.0', info: { title: 't', version: '0' }, paths: {} }
        },
        logger: new log.Logger('test', 'ERROR'),
        silent: true
      })

      const fields = toDocumentFieldsV3({
        documentObject: toDocument(fixture, on),
        stackTrail: new StackTrail([]),
        context
      })

      const items = (on === 'paths' ? fields.operations : fields.webhooks) ?? []

      return {
        kept: items.map(({ operationId }) => operationId),
        logged: context.issues.map(({ type, level, message, location }) => ({
          type,
          level,
          message,
          location
        })),
        security: fields.security
      }
    }

    const label = `${dialect} ${on}`

    Deno.test(`${label}: a broken scheme drops exactly the operations that require it`, () => {
      const { kept, logged } = parse({
        root: [{ apiKey: [] }],
        operations: {
          ownBroken: [{ broken: [] }],
          brokenAlternative: [{ apiKey: [] }, { broken: [] }],
          brokenAnd: [{ apiKey: [], broken: [] }],
          ownGood: [{ apiKey: [] }],
          inherits: undefined,
          public: []
        }
      })

      assertEquals(kept, ['ownGood', 'inherits', 'public'])
      assertEquals(logged.filter(({ type }) => type === 'INVALID_SECURITY_SCHEME').length, 1)
      assertEquals(
        logged.filter(({ type }) => type === 'INVALID_OPERATION'),
        [
          dropped('ownBroken', on, failedMessage),
          dropped('brokenAlternative', on, failedMessage),
          dropped('brokenAnd', on, failedMessage)
        ]
      )
    })

    Deno.test(`${label}: a root requirement on a broken scheme drops the operations that inherit it`, () => {
      const { kept, logged, security } = parse({
        root: [{ broken: [] }],
        operations: { inherits: undefined, ownGood: [{ apiKey: [] }], public: [] }
      })

      assertEquals(kept, ['ownGood', 'public'])
      assertEquals(security, undefined)
      assertEquals(logged.filter(({ type }) => type === 'INVALID_OPERATION'), [
        {
          type: 'INVALID_OPERATION',
          level: 'warning',
          message:
            "Root security requires security scheme 'broken', which failed to parse; root security is left out and operations that inherit it are dropped",
          location: 'security'
        },
        dropped(
          'inherits',
          on,
          "Inherits root security, which requires security scheme 'broken', which failed to parse"
        )
      ])
    })

    Deno.test(`${label}: a root requirement on an undefined scheme is left out with a warning when nothing inherits it`, () => {
      const { kept, logged, security } = parse({
        root: [{ missing: [] }],
        operations: { ownGood: [{ apiKey: [] }], public: [] }
      })

      assertEquals(kept, ['ownGood', 'public'])
      assertEquals(security, undefined)
      assertEquals(logged.filter(({ type }) => type === 'INVALID_OPERATION'), [
        {
          type: 'INVALID_OPERATION',
          level: 'warning',
          message:
            "Root security requires security scheme 'missing', which is not defined in components.securitySchemes; root security is left out and operations that inherit it are dropped",
          location: 'security'
        }
      ])
    })

    Deno.test(`${label}: a usable root security is kept on the document`, () => {
      const { kept, security } = parse({
        root: [{ apiKey: [] }],
        operations: { inherits: undefined }
      })

      assertEquals(kept, ['inherits'])
      assertEquals(
        security?.map(({ requirement }) => requirement),
        [{ apiKey: [] }]
      )
    })

    Deno.test(`${label}: a mutualTLS scheme core does not parse yet does not drop its operations`, () => {
      const { kept, logged, security } = parse({
        schemes: { mtls: { type: 'mutualTLS' } },
        root: [{ mtls: [] }],
        operations: { inherits: undefined, own: [{ mtls: [] }] }
      })

      assertEquals(kept, ['inherits', 'own'])
      assertEquals(
        security?.map(({ requirement }) => requirement),
        [{ mtls: [] }]
      )
      assertEquals(logged.filter(({ type }) => type === 'INVALID_OPERATION'), [])
    })

    Deno.test(`${label}: a requirement naming an undefined scheme drops its operation`, () => {
      const { kept, logged } = parse({
        operations: {
          missing: [{ missing: [] }],
          twoMissing: [{ first: [], second: [] }],
          missingAndBroken: [{ missing: [] }, { broken: [] }],
          ownGood: [{ apiKey: [] }]
        }
      })

      assertEquals(kept, ['ownGood'])
      assertEquals(logged.filter(({ type }) => type === 'INVALID_OPERATION'), [
        dropped(
          'missing',
          on,
          "Requires security scheme 'missing', which is not defined in components.securitySchemes"
        ),
        dropped(
          'twoMissing',
          on,
          "Requires security schemes 'first', 'second', which are not defined in components.securitySchemes"
        ),
        dropped(
          'missingAndBroken',
          on,
          `${failedMessage}. Requires security scheme 'missing', which is not defined in components.securitySchemes`
        )
      ])
    })

    Deno.test(`${label}: an empty requirement {} drops nothing`, () => {
      const { kept, logged } = parse({
        root: [{}],
        operations: { inherits: undefined, optional: [{}, { apiKey: [] }], onlyEmpty: [{}] }
      })

      assertEquals(kept, ['inherits', 'optional', 'onlyEmpty'])
      assertEquals(logged, [brokenSchemeError])
    })

    for (const [rootLabel, root] of [
      ['a string', 'apiKey'],
      ['an object', { apiKey: [] }],
      ['null', null],
      ['a list with a string entry', ['apiKey']],
      ['a list whose scopes are not a list', [{ apiKey: 'read' }]]
    ] as const) {
      Deno.test(`${label}: a root security that is ${rootLabel} drops the operations that inherit it`, () => {
        const { kept, logged, security } = parse({
          root,
          operations: { inherits: undefined, ownGood: [{ apiKey: [] }], public: [] }
        })

        assertEquals(kept, ['ownGood', 'public'])
        assertEquals(security, undefined)
        assertEquals(
          logged
            .filter(({ type }) => type === 'INVALID_OPERATION')
            .map(({ level, location }) => ({ level, location })),
          [
            { level: 'warning', location: 'security' },
            { level: 'error', location: toLocation('inherits', on) }
          ]
        )
        assertEquals(logged.at(-1), dropped('inherits', on, inheritsMessage))
      })
    }

    for (const [ownLabel, own, message] of [
      ['a string', 'apiKey', '"security" must be a list of security requirement objects, got string'],
      [
        'a list with a string entry',
        ['apiKey'],
        '"security" entry 0 must be a security requirement object, got string'
      ],
      [
        'a list whose scopes are not a list',
        [{}, { apiKey: ['read', 1] }],
        `"security" entry 1 must map each scheme name to a list of scopes; 'apiKey' does not`
      ]
    ] as const) {
      Deno.test(`${label}: an operation security that is ${ownLabel} drops the operation`, () => {
        const { kept, logged } = parse({
          root: [{ apiKey: [] }],
          operations: { malformed: own, inherits: undefined }
        })

        assertEquals(kept, ['inherits'])
        assertEquals(logged.filter(({ type }) => type === 'INVALID_OPERATION'), [
          dropped('malformed', on, message)
        ])
      })
    }
  }
}
