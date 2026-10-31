import * as v from 'valibot'
import type { ParseContextType } from '@/context/parseTypes.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { isPlainObject } from '@/parse/isPlainObject.ts'
import {
  oasExternalDocsData,
  type OasExternalDocsData
} from '@/oas/externalDocs/externalDocsTypes.ts'

// Tags and external docs describe the document; they do not change how an
// operation renders. A malformed one is left out with a warning, and its
// parent is kept. Shared by the 3.0, 3.1 and 3.2 parsers.

export type ToTagListArgs<Tag> = {
  tags: Tag[]
  /** Trail that ends in the `tags` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Check the root `tags` field before its entries are parsed. Not an array:
 * logs one `INVALID_TAG` warning and returns `undefined`, read as no tags.
 */
export const toTagList = <Tag>({
  tags,
  stackTrail,
  context
}: ToTagListArgs<Tag>): Tag[] | undefined => {
  if (Array.isArray(tags)) {
    return tags
  }

  context.logIssueNoKey({
    stackTrail,
    parent: tags,
    level: 'warning',
    type: 'INVALID_TAG',
    message: '"tags" must be an array; left out'
  })

  return undefined
}

export type IsValidTagArgs = {
  tag: unknown
  /** Trail that ends in the entry's index. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * A tag entry must be a plain object with a string `name`. Any other entry
 * logs one `INVALID_TAG` warning, and the caller leaves it out.
 */
export const isValidTag = ({ tag, stackTrail, context }: IsValidTagArgs): boolean => {
  if (isPlainObject(tag) && typeof tag.name === 'string') {
    return true
  }

  context.logIssueNoKey({
    stackTrail,
    parent: tag,
    level: 'warning',
    type: 'INVALID_TAG',
    message: 'Tag is not an object with a string name; left out'
  })

  return false
}

export type ToValidExternalDocsArgs = {
  externalDocs: unknown
  /** Trail that ends in the `externalDocs` key. */
  stackTrail: StackTrail
  context: ParseContextType
}

/**
 * Validate an `externalDocs` object. One that fails `oasExternalDocsData`
 * logs one `INVALID_EXTERNAL_DOCS` warning and returns `undefined`.
 */
export const toValidExternalDocs = ({
  externalDocs,
  stackTrail,
  context
}: ToValidExternalDocsArgs): OasExternalDocsData | undefined => {
  const result = v.safeParse(oasExternalDocsData, externalDocs)

  if (result.success) {
    return result.output
  }

  const reason = result.issues.map(({ message }) => message).join(', ')

  context.logIssueNoKey({
    stackTrail,
    parent: externalDocs,
    level: 'warning',
    type: 'INVALID_EXTERNAL_DOCS',
    message: `External docs object is invalid (${reason}); left out`
  })

  return undefined
}
