/**
 * The process `parseBounded` starts: parses the document in its first argument
 * and prints what it parsed to as JSON.
 */

import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { OasIntersection } from '@/oas/intersection/Intersection.ts'
import { OasRef } from '@/oas/ref/Ref.ts'
import { StackTrail } from '@/context/StackTrail.ts'

// `toJsonSchema` writes neither a ref's keywords (#338) nor all of an intersection's.
const toIntersectionJson = OasIntersection.prototype.toJsonSchema

Object.defineProperty(OasRef.prototype, 'toJsonSchema', {
  value(this: OasRef<'schema'>) {
    const { $ref, nullable, readOnly, writeOnly, description, default: defaultValue, required } = this

    return { $ref, nullable, readOnly, writeOnly, description, default: defaultValue, required }
  }
})

Object.defineProperty(OasIntersection.prototype, 'toJsonSchema', {
  value(this: OasIntersection, options: { resolve: boolean }) {
    return {
      ...toIntersectionJson.call(this, options),
      allOf: this.members.map(member => ({
        ...member.toJsonSchema(options),
        ...(member.isRef() || member.not === undefined ? {} : { not: {} })
      })),
      externalDocs: this.externalDocs?.url,
      ...this.extensionFields
    }
  }
})

const { document, system, targets }= JSON.parse(Deno.args[0] ?? '{}')

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
