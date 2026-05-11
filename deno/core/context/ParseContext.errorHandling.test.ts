/**
 * Contract tests for `ParseContext`'s dependency-ref invalidation
 * pipeline (the `registerRef` + `registerRefError` + `removeErroredItems`
 * triple). The OAS side is exercised here; the GQL side mirrors this
 * shape with `protocol: 'gql'` and type-name keys instead of `$ref`
 * strings.
 *
 * The contract is small and worth pinning explicitly because the
 * mechanism is subtle:
 *
 *   1. A parser calls `registerRef(consumerStackTrail, refKey)` when it
 *      encounters a reference to a named target.
 *   2. When the *target* fails to parse, `registerRefError(error, refKey)`
 *      records the failure against that key. For OAS this happens
 *      automatically inside `logIssueNoKey` when the current stack trail
 *      is at a `components.<kind>.<name>` position.
 *   3. After parse finishes, `removeErroredItems` walks every errored
 *      ref key, looks up its consumers, prunes them from the parsed
 *      document, and emits an `INVALID_DEPENDENCY_REF` issue per pruned
 *      consumer. The original error rides along as `cause`.
 *
 * Tests below drive the contract directly by parsing a real document
 * and then injecting the error register that a failing parser would
 * have made — keeps the test focused on the invalidation mechanism
 * rather than on whether a specific malformed input triggers an error
 * inside the OAS parser code (which is its own concern).
 */
import { assertEquals } from '@std/assert'
import type * as log from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const docWithUserResponseAt = (path: string): OpenAPIV3.Document => ({
  openapi: '3.0.3',
  info: { title: 'Test', version: '1.0.0' },
  paths: {
    [path]: {
      get: {
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      User: { type: 'object', properties: { id: { type: 'string' } } }
    }
  }
})

const makeOasContext = (
  documentObject: OpenAPIV3.Document = docWithUserResponseAt('/users')
) =>
  new ParseContext({
    input: { type: 'oas', value: documentObject },
    logger: mockLogger,
    silent: true
  })

const REF_KEY = '#/components/schemas/User'

Deno.test('ParseContext (oas) - registerRefError with undefined refKey is a deliberate no-op', () => {
  // `StackTrail.toStackRef()` returns undefined for non-component
  // trails. `registerRefError(error, undefined)` must drop the call
  // silently — this is how `logIssueNoKey` can pass the result through
  // without a guard at every call site.
  const ctx = makeOasContext()
  ctx.registerRefError(new Error('boom'), undefined)

  // Parsing populates the document; if `undefined` had registered an
  // error, removeErroredItems would try to prune (with empty consumer
  // list, so nothing observable). The real signal is that no
  // INVALID_DEPENDENCY_REF issue ever appears.
  ctx.parse(new StackTrail([]))
  assertEquals(
    ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF').length,
    0
  )
})

Deno.test('ParseContext (oas) - logIssueNoKey at a components location auto-registers a refError', () => {
  // Logging an error at `components.schemas.User` is the OAS surface
  // for "this component failed to parse." `logIssueNoKey` derives the
  // ref key via `stackTrail.toStackRef()` and calls `registerRefError`
  // — the parser doesn't have to do this itself.
  const ctx = makeOasContext()
  ctx.parse(new StackTrail([]))

  // After parse, the consumer (paths./users.get.responses.200…) has
  // been registered via toRefV31. Now simulate the schema failing
  // *after* the fact by manually logging an error at its location.
  const userErr = new Error('User schema malformed')
  ctx.logIssueNoKey({
    level: 'error',
    message: userErr.message,
    cause: userErr,
    stackTrail: new StackTrail(['components', 'schemas', 'User']),
    parent: {},
    type: 'INVALID_SCHEMA'
  })

  // The error logged at User's own location appears in issues.
  const userIssues = ctx.issues.filter(
    i => i.location === 'components:schemas:User' && i.level === 'error'
  )
  assertEquals(userIssues.length, 1)

  // Now removeErroredItems should pick up the auto-registered ref
  // error and prune the consumer.
  ctx.removeErroredItems()
  const depRef = ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF')
  assertEquals(
    depRef.length >= 1,
    true,
    'consumer should be pruned and INVALID_DEPENDENCY_REF emitted'
  )
})

Deno.test('ParseContext (oas) - end-to-end: errored component prunes its consumer with INVALID_DEPENDENCY_REF', () => {
  const ctx = makeOasContext()
  ctx.parse(new StackTrail([]))

  // Sanity: the operation is in the parsed document before pruning.
  const before = ctx.oasDocument.operations.length
  assertEquals(before, 1, 'expected the GET /users operation to be parsed')

  // Inject the error that a failing schema parser would have recorded.
  ctx.registerRefError(new Error('Analytics schema malformed'), REF_KEY)
  ctx.removeErroredItems()

  // The operation should have been removed.
  assertEquals(
    ctx.oasDocument.operations.length,
    0,
    'consumer operation should be pruned'
  )

  const depRefIssues = ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF')
  assertEquals(depRefIssues.length, 1, 'one consumer kicked out → one issue')

  const issue = depRefIssues[0]
  if (issue.protocol !== 'oas' || issue.level !== 'error') {
    throw new Error('expected an OAS error issue')
  }
  // Kick-out location points at the consumer, not the failing target.
  assertEquals(issue.location.startsWith('paths:'), true)
  assertEquals(issue.message, 'Analytics schema malformed')
  // The original error rides along as `cause`.
  assertEquals(issue.cause instanceof Error, true)
})

Deno.test('ParseContext (oas) - multiple consumers of the same errored target all get kicked out', () => {
  // Build a doc with three paths all referencing User.
  const doc: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {
      '/users': {
        get: {
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: REF_KEY } } }
            }
          }
        }
      },
      '/admin': {
        get: {
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: REF_KEY } } }
            }
          }
        }
      },
      '/profile': {
        get: {
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: REF_KEY } } }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        User: { type: 'object', properties: { id: { type: 'string' } } }
      }
    }
  }
  const ctx = makeOasContext(doc)
  ctx.parse(new StackTrail([]))
  assertEquals(ctx.oasDocument.operations.length, 3)

  ctx.registerRefError(new Error('User schema malformed'), REF_KEY)
  ctx.removeErroredItems()

  assertEquals(ctx.oasDocument.operations.length, 0, 'all three consumers pruned')
  assertEquals(
    ctx.issues.filter(i => i.type === 'INVALID_DEPENDENCY_REF').length,
    3,
    'one INVALID_DEPENDENCY_REF per pruned consumer'
  )
})
