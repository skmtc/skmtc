import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { toOptionalSchemaV3 } from '../schema/toSchemasV3.ts'
import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { OasMediaType } from './MediaType.ts'
import type { MediaTypeFields } from './MediaType.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToMediaTypeItemV3Args = {
  mediaTypeItem: OpenAPIV3.MediaTypeObject
  mediaType: string
  context: ParseContext
}

export const toMediaTypeItemV3 = ({
  mediaTypeItem,
  mediaType,
  context
}: ToMediaTypeItemV3Args): OasMediaType => {
  const { schema, example, examples, ...skipped } = mediaTypeItem

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: mediaTypeItem,
    context
  })

  const fields: MediaTypeFields = {
    mediaType,
    schema: context.trace('schema', () => toOptionalSchemaV3({ schema, context })),
    examples: context.trace('examples', () =>
      toExamplesV3({
        example,
        examples,
        exampleKey: mediaType,
        context
      })
    ),
    extensionFields
  }

  return new OasMediaType(fields)
}

type ToMediaTypeItemsV3Args = {
  content: Record<string, OpenAPIV3.MediaTypeObject>
  context: ParseContext
}

export const toMediaTypeItemsV3 = ({
  content,
  context
}: ToMediaTypeItemsV3Args): Record<string, OasMediaType> => {
  return Object.fromEntries(
    Object.entries(content).map(([mediaType, value]) => [
      mediaType,
      context.trace(mediaType, () =>
        toMediaTypeItemV3({
          mediaTypeItem: value,
          mediaType,
          context
        })
      )
    ])
  )
}

type ToOptionalMediaTypeItemsV3Args = {
  content: Record<string, OpenAPIV3.MediaTypeObject> | undefined
  context: ParseContext
}

export const toOptionalMediaTypeItemsV3 = ({
  content,
  context
}: ToOptionalMediaTypeItemsV3Args): Record<string, OasMediaType> | undefined => {
  if (!content) {
    return
  }

  return toMediaTypeItemsV3({ content, context })
}
