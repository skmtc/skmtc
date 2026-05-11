import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasTag } from './Tag.ts'
import type { TagFields } from './Tag.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToTagsV3Args = {
  tags: OpenAPIV3.TagObject[] | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toTagsV3 = ({ tags, stackTrail, context }: ToTagsV3Args): OasTag[] | undefined => {
  if (!tags) {
    return undefined
  }

  return tags.map(tag => toTagV3({ tag, stackTrail, context }))
}

export type ToTagV3Args = {
  tag: OpenAPIV3.TagObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toTagV3 = ({ tag, stackTrail, context }: ToTagV3Args): OasTag => {
  const { name, description, ...skipped } = tag

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: tag,
    context,
    stackTrail,
    parentType: 'tag'
  })

  const fields: TagFields = {
    name,
    description,
    extensionFields
  }

  return new OasTag(fields)
}
