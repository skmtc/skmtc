import { assertEquals } from '@std/assert/equals'
import { ResultsLog } from './ResultsLog.ts'

Deno.test('ResultsLog - captures single success result', () => {
  const log = new ResultsLog()
  log.capture('models:User', 'success')

  const tree = log.toTree()
  assertEquals(tree, {
    models: {
      User: 'success'
    }
  })
})

Deno.test('ResultsLog - captures multiple results at different paths', () => {
  const log = new ResultsLog()
  log.capture('models:User', 'success')
  log.capture('models:Product', 'error')
  log.capture('types:Status', 'success')

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
  log.capture('api:createUser', 'success')
  log.capture('api:createUser', 'error')

  const tree = log.toTree()
  const api = tree['api'] as Record<string, unknown>
  assertEquals(api['createUser'], 'error')
})

Deno.test('ResultsLog - error is not overwritten by success', () => {
  const log = new ResultsLog()
  log.capture('api:createUser', 'error')
  log.capture('api:createUser', 'success')

  const tree = log.toTree()
  const api = tree['api'] as Record<string, unknown>
  assertEquals(api['createUser'], 'error')
})

Deno.test('ResultsLog - warning takes precedence over success', () => {
  const log = new ResultsLog()
  log.capture('models:User', 'success')
  log.capture('models:User', 'warning')

  const tree = log.toTree()
  const models = tree['models'] as Record<string, unknown>
  assertEquals(models['User'], 'warning')
})

Deno.test('ResultsLog - error takes precedence over warning', () => {
  const log = new ResultsLog()
  log.capture('models:User', 'warning')
  log.capture('models:User', 'error')

  const tree = log.toTree()
  const models = tree['models'] as Record<string, unknown>
  assertEquals(models['User'], 'error')
})

Deno.test('ResultsLog - success takes precedence over skipped', () => {
  const log = new ResultsLog()
  log.capture('api:endpoint', 'skipped')
  log.capture('api:endpoint', 'success')

  const tree = log.toTree()
  const api = tree['api'] as Record<string, unknown>
  assertEquals(api['endpoint'], 'success')
})

Deno.test('ResultsLog - skipped takes precedence over notSupported', () => {
  const log = new ResultsLog()
  log.capture('feature:new', 'notSupported')
  log.capture('feature:new', 'skipped')

  const tree = log.toTree()
  const feature = tree['feature'] as Record<string, unknown>
  assertEquals(feature['new'], 'skipped')
})

Deno.test('ResultsLog - handles deeply nested paths', () => {
  const log = new ResultsLog()
  log.capture('generation:models:User:properties:name', 'success')
  log.capture('generation:models:User:properties:email', 'warning')

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
  log.capture('simple', 'success')

  const tree = log.toTree()
  assertEquals(tree, {
    simple: 'success'
  })
})

Deno.test('ResultsLog - handles empty log', () => {
  const log = new ResultsLog()

  const tree = log.toTree()
  assertEquals(tree, {})
})

Deno.test('ResultsLog - handles complex multi-level hierarchy', () => {
  const log = new ResultsLog()
  log.capture('api:models:User', 'success')
  log.capture('api:models:Product', 'error')
  log.capture('api:operations:getUser', 'success')
  log.capture('types:Status', 'success')
  log.capture('validators:email', 'warning')

  const tree = log.toTree()
  assertEquals(tree, {
    api: {
      models: {
        User: 'success',
        Product: 'error'
      },
      operations: {
        getUser: 'success'
      }
    },
    types: {
      Status: 'success'
    },
    validators: {
      email: 'warning'
    }
  })
})

Deno.test('ResultsLog - multiple captures with different severities', () => {
  const log = new ResultsLog()
  log.capture('test', 'notSupported')
  log.capture('test', 'skipped')
  log.capture('test', 'success')
  log.capture('test', 'warning')
  log.capture('test', 'error')

  const tree = log.toTree()
  assertEquals(tree.test, 'error')
})
