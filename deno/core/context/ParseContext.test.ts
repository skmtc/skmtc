import { ParseContext } from './ParseContext.ts'
import { StackTrail } from './StackTrail.ts'
import schema from '../_schemas/deno.json' with { type: 'json' }
// import schema from '../_schemas/cloudflare.json' with { type: 'json' }
import type { OpenAPIV3 } from 'openapi-types'

const parseContext = new ParseContext({
  documentObject: schema as unknown as OpenAPIV3.Document,
  logger: console as any,
  stackTrail: new StackTrail(),
  silent: true
})

const startTime = performance.now()

parseContext.parse()

const endTime = performance.now()

const filteredWarnings = parseContext.warnings.filter(warning => {
  return (
    warning.type === 'UNEXPECTED_PROPERTY' &&
    ![
      'Unexpected property "items" in "schema:object"',
      'Unexpected property "uniqueItems" in "schema:object"'
    ].includes(warning.message)
  )
})

const warningsByProperty = filteredWarnings.reduce<Record<string, number>>((acc, warning) => {
  const { stackTrail } = warning.location

  const property = stackTrail[stackTrail.length - 1]

  console.log(`STACK TRACE: ${stackTrail.toString()}`)
  console.log(`WARNING: ${warning.message}`)
  console.log(`PARENT: ${JSON.stringify(warning.parent, null, 2)}`)
  console.log('')

  return {
    ...acc,
    [property]: (acc[property] ?? 0) + 1
  }
}, {})

const items = Object.entries(warningsByProperty).sort((a, b) => a[1] - b[1])

if (items.length > 0) {
  console.log(JSON.stringify(Object.fromEntries(items), null, 2))
}

console.log(`Time taken: ${endTime - startTime} milliseconds`)

console.log(`Number of warnings: ${filteredWarnings.length}`)
