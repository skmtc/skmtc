import { assertEquals } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import { OasBase } from './OasBase.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { ParseContext } from '@/context/ParseContext.ts'

const buildContext = (opts: { stackTrail?: StackTrail } = {}): ParseContext => {
  const ctx = new ParseContext({
    input: {
      type: 'oas',
      value: { openapi: '3.0.0', info: { title: 't', version: '0' }, paths: {} }
    },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  ctx.currentStackTrail = opts.stackTrail
  return ctx
}

Deno.test('OasBase - no context → no stackTrail captured', () => {
  const node = new OasBase()
  assertEquals(node.stackTrail, undefined)
  assertEquals(node.toLocation(), undefined)
})

Deno.test('OasBase - currentStackTrail set → stackTrail snapshot captured', () => {
  const ctx = buildContext({ stackTrail: new StackTrail(['components', 'schemas', 'User']) })
  const node = new OasBase(ctx)
  assertEquals(node.stackTrail?.stackTrail, ['components', 'schemas', 'User'])
  assertEquals(node.toLocation(), '#/components/schemas/User')
})

Deno.test('OasBase - snapshot is cloned (factory mutation after construction does not corrupt)', () => {
  const trail = new StackTrail(['components', 'schemas', 'User'])
  const ctx = buildContext({ stackTrail: trail })
  const node = new OasBase(ctx)
  // Mutate the original trail; node's snapshot must be independent.
  trail.append('properties').append('email')
  assertEquals(node.toLocation(), '#/components/schemas/User')
})

Deno.test('OasBase - no currentStackTrail → no snapshot', () => {
  const ctx = buildContext()
  const node = new OasBase(ctx)
  assertEquals(node.stackTrail, undefined)
  assertEquals(node.toLocation(), undefined)
})
