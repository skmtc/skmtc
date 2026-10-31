import { assertEquals } from '@std/assert/equals'
import { StackTrail } from '@/context/StackTrail.ts'
import { ResultsLog } from '@/helpers/ResultsLog.ts'

const trail = (...frames: string[]) => new StackTrail(frames)

Deno.test('ResultsLog - captures single success result', () => {
  const log = new ResultsLog()
  log.capture(trail('models', 'User'), 'success')

  const tree = log.toTree()
  assertEquals(tree, {
    models: {
      User: 'success'
    }
  })
})

Deno.test('ResultsLog - captures multiple results at different paths', () => {
  const log = new ResultsLog()
  log.capture(trail('models', 'User'), 'success')
  log.capture(trail('models', 'Product'), 'error')
  log.capture(trail('types', 'Status'), 'success')

  const tree = log.toTree()
  assertEquals(tree, {
    models: {
      User: 'success',
      Product: 'error'
    },
    types: {
      Status: 'success'
    }
  })
})

Deno.test('ResultsLog - error takes precedence over success', () => {
  const log = new ResultsLog()
  log.capture(trail('api', 'createUser'), 'success')
  log.capture(trail('api', 'createUser'), 'error')

  assertEquals(log.toTree(), { api: { createUser: 'error' } })
})

Deno.test('ResultsLog - error is not overwritten by success', () => {
  const log = new ResultsLog()
  log.capture(trail('api', 'createUser'), 'error')
  log.capture(trail('api', 'createUser'), 'success')

  assertEquals(log.toTree(), { api: { createUser: 'error' } })
})

Deno.test('ResultsLog - warning takes precedence over success', () => {
  const log = new ResultsLog()
  log.capture(trail('models', 'User'), 'success')
  log.capture(trail('models', 'User'), 'warning')

  assertEquals(log.toTree(), { models: { User: 'warning' } })
})

Deno.test('ResultsLog - error takes precedence over warning', () => {
  const log = new ResultsLog()
  log.capture(trail('models', 'User'), 'warning')
  log.capture(trail('models', 'User'), 'error')

  assertEquals(log.toTree(), { models: { User: 'error' } })
})

Deno.test('ResultsLog - success takes precedence over skipped', () => {
  const log = new ResultsLog()
  log.capture(trail('api', 'endpoint'), 'skipped')
  log.capture(trail('api', 'endpoint'), 'success')

  assertEquals(log.toTree(), { api: { endpoint: 'success' } })
})

Deno.test('ResultsLog - skipped takes precedence over notSupported', () => {
  const log = new ResultsLog()
  log.capture(trail('feature', 'new'), 'notSupported')
  log.capture(trail('feature', 'new'), 'skipped')

  assertEquals(log.toTree(), { feature: { new: 'skipped' } })
})

Deno.test('ResultsLog - handles deeply nested paths', () => {
  const log = new ResultsLog()
  log.capture(trail('generation', 'models', 'User', 'properties', 'name'), 'success')
  log.capture(trail('generation', 'models', 'User', 'properties', 'email'), 'warning')

  const tree = log.toTree()
  assertEquals(tree, {
    generation: {
      models: {
        User: {
          properties: {
            name: 'success',
            email: 'warning'
          }
        }
      }
    }
  })
})

Deno.test('ResultsLog - handles single level paths', () => {
  const log = new ResultsLog()
  log.capture(trail('simple'), 'success')

  assertEquals(log.toTree(), { simple: 'success' })
})

Deno.test('ResultsLog - handles empty log', () => {
  const log = new ResultsLog()

  assertEquals(log.toTree(), {})
})

Deno.test('ResultsLog - multiple captures with different severities', () => {
  const log = new ResultsLog()
  log.capture(trail('test'), 'notSupported')
  log.capture(trail('test'), 'skipped')
  log.capture(trail('test'), 'success')
  log.capture(trail('test'), 'warning')
  log.capture(trail('test'), 'error')

  assertEquals(log.toTree().test, 'error')
})

Deno.test('ResultsLog - a frame with a colon is one key in the tree', () => {
  const log = new ResultsLog()
  log.capture(trail('generate', 'gen', '/pets/{id}:archive', 'post'), 'success')

  assertEquals(log.toTree(), {
    generate: { gen: { '/pets/{id}:archive': { post: 'success' } } }
  })
})

Deno.test('ResultsLog - frames with % and escape-like text are kept verbatim', () => {
  const log = new ResultsLog()
  log.capture(trail('100%', 'a%3Ab', 'c%25d'), 'success')

  assertEquals(log.toTree(), { '100%': { 'a%3Ab': { 'c%25d': 'success' } } })
})

Deno.test('ResultsLog - a literal %3A frame and a colon frame are different results', () => {
  const log = new ResultsLog()
  log.capture(trail('a:b'), 'success')
  log.capture(trail('a%3Ab'), 'error')

  assertEquals(log.toTree(), { 'a:b': 'success', 'a%3Ab': 'error' })
})

Deno.test('ResultsLog - Object.prototype member names are ordinary keys', () => {
  const log = new ResultsLog()
  log.capture(trail('query', 'toString', 'variant', 'main'), 'error')
  log.capture(trail('query', 'constructor', 'variant', 'main'), 'error')
  log.capture(trail('query', '__proto__', 'variant', 'main'), 'error')

  assertEquals(
    JSON.stringify(log.toTree()),
    '{"query":{"toString":{"variant":{"main":"error"}},"constructor":{"variant":{"main":"error"}},"__proto__":{"variant":{"main":"error"}}}}'
  )
  assertEquals(Object.hasOwn(Object.prototype.toString, 'variant'), false)
})

Deno.test('ResultsLog - an integer-string frame keeps its named siblings', () => {
  const log = new ResultsLog()
  log.capture(trail('op', 'variant', '2'), 'success')
  log.capture(trail('op', 'variant', 'main'), 'error')

  assertEquals(JSON.parse(JSON.stringify(log.toTree())), {
    op: { variant: { '2': 'success', main: 'error' } }
  })
})

Deno.test('ResultsLog - handles complex multi-level hierarchy', () => {
  const log = new ResultsLog()
  log.capture(trail('api', 'models', 'User'), 'success')
  log.capture(trail('api', 'models', 'Product'), 'error')
  log.capture(trail('api', 'operations', 'getUser'), 'success')
  log.capture(trail('types', 'Status'), 'success')

  assertEquals(log.toTree(), {
    api: {
      models: { User: 'success', Product: 'error' },
      operations: { getUser: 'success' }
    },
    types: { Status: 'success' }
  })
})

Deno.test('ResultsLog - a capture inside nested trace keeps its frames after trace returns', () => {
  const log = new ResultsLog()

  new StackTrail(['generate']).trace('gen', genTrail => {
    genTrail.trace(['/pets', 'get'], opTrail => {
      log.capture(opTrail, 'success')
    })
  })

  assertEquals(log.toTree(), { generate: { gen: { '/pets': { get: 'success' } } } })
})
