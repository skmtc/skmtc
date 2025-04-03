import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasTag } from './Tag.ts'
import type { TagFields } from './Tag.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToTagsV3Args = {
  tags: OpenAPIV3.TagObject[] | undefined
  context: ParseContext
}

export const toTagsV3 = ({ tags, context }: ToTagsV3Args): OasTag[] | undefined => {
  if (!tags) {
    return undefined
  }

  return tags.map(tag => toTagV3({ tag, context }))
}

type ToTagV3Args = {
  tag: OpenAPIV3.TagObject
  context: ParseContext
}

export const toTagV3 = ({ tag, context }: ToTagV3Args): OasTag => {
  const { name, description, ...skipped } = tag

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: tag,
    context
  })

  const fields: TagFields = {
    name,
    description,
    extensionFields
  }

  return new OasTag(fields)
}
