import * as log from '@std/log'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

/**
 * Parse a document of the given `openapi` version whose one schema is an
 * array with no `items`, and return the level and message of each issue.
 */
export const toArrayWithoutItemsIssues = (openapi: string) => {
  const document = {
    openapi,
    info: { title: 't', version: '1' },
    paths: {},
    components: { schemas: { Tags: { type: 'array' } } }
  }

  const context = new ParseContext({
    input: { type: 'oas', value: toDocumentObject(document, 'test document') },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })

  context.parse(new StackTrail([]))

  return context.issues.map(({ level, message }) => ({ level, message }))
}
