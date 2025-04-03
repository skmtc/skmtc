import { ParseContext } from './ParseContext.ts'
import { StackTrail } from './StackTrail.ts'
import cloudflareSchema from '../_schemas/cloudflare.json' with { type: 'json' }
import type { OpenAPIV3 } from 'openapi-types'

const parseContext = new ParseContext({
  documentObject: cloudflareSchema as unknown as OpenAPIV3.Document,
  logger: console as any,
  stackTrail: new StackTrail(),
  silent: true
})

const startTime = performance.now()

parseContext.parse()

const endTime = performance.now()

const warningsByProperty = parseContext.warnings.reduce<Record<string, number>>((acc, warning) => {
  const { stackTrail } = warning.location

  const property = stackTrail[stackTrail.length - 1]

  console.log(JSON.stringify(stackTrail.toString(), null, 2))

  return {
    ...acc,
    [property]: (acc[property] ?? 0) + 1
  }
}, {})

const items = Object.entries(warningsByProperty).sort((a, b) => a[1] - b[1])

console.log(JSON.stringify(items, null, 2))

console.log(`Time taken: ${endTime - startTime} milliseconds`)

console.log(`Number of warnings: ${parseContext.warnings.length}`)
