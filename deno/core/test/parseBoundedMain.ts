/**
 * The process `parseBounded` starts: parses the document in its first argument
 * and prints what it parsed to as JSON.
 */

import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

const { document, system, targets } = JSON.parse(Deno.args[0] ?? '{}')

const start = performance.now()
const context = new ParseContext({
  input: { type: 'oas', value: document },
  logger: new log.Logger('test', 'ERROR'),
  silent: true,
  system
})
const parsed = context.parse(new StackTrail(['TEST']))
const milliseconds = performance.now() - start

if (parsed.type !== 'oas') {
  throw new Error('Expected an OpenAPI document')
}

const toShape = (key: string, component: { toJsonSchema: (options: { resolve: boolean }) => unknown } | undefined) => [
  key,
  component?.toJsonSchema({ resolve: false })
]

const schemas = Object.entries(parsed.value.components?.schemas ?? {}).map(([name, schema]) => toShape(name, schema))
const deep = targets.map((pointer: string) => {
  const target = parsed.value.toRefTarget(pointer)

  return toShape(pointer, target?.oasType === 'schema' ? target : undefined)
})

console.log(
  JSON.stringify({
    milliseconds,
    schemas: Object.fromEntries([...schemas, ...deep]),
    issues: context.issues.map(({ level, type, message }) => ({ level, type, message }))
  })
)
