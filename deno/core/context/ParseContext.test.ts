import { ParseContext } from './ParseContext.ts'
import { StackTrail } from './StackTrail.ts'
import cloudflareSchema from '../_schemas/cloudflare.json' with { type: 'json' }
import type { OpenAPIV3 } from 'openapi-types'

const parseContext = new ParseContext({
  documentObject: cloudflareSchema as unknown as OpenAPIV3.Document,
  logger: console as any,
  stackTrail: new StackTrail()
})

const startTime = performance.now()

const oasDocument = parseContext.parse()

const endTime = performance.now()

console.log(`Time taken: ${endTime - startTime} milliseconds`)

console.log(oasDocument)
