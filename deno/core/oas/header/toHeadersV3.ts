import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { toOptionalSchemaV3 } from '../schema/toSchemasV3.ts'
import type { ParseContext } from '../../context/ParseContext.ts'
import { isRef } from '../../helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasHeader } from './Header.ts'
import type { HeaderFields } from './Header.ts'
import type { OasRef } from '../ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToHeadersV3Args = {
  headers: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.HeaderObject> | undefined
  context: ParseContext
}

export const toHeadersV3 = ({
  headers,
  context
}: ToHeadersV3Args): Record<string, OasHeader | OasRef<'header'>> | undefined => {
  if (!headers) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      return [key, context.trace(key, () => toHeaderV3({ header: value, context }))]
    })
  )
}

type ToHeaderV3Args = {
  header: OpenAPIV3.ReferenceObject | OpenAPIV3.HeaderObject
  context: ParseContext
}

const toHeaderV3 = ({ header, context }: ToHeaderV3Args): OasHeader | OasRef<'header'> => {
  if (isRef(header)) {
    return toRefV31({ ref: header, refType: 'header', context })
  }

  const { description, required, deprecated, schema, example, examples, content, ...skipped } =
    header

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  const fields: HeaderFields = {
    description,
    required,
    deprecated,
    schema: context.trace('schema', () => toOptionalSchemaV3({ schema, context })),
    examples: toExamplesV3({
      examples,
      example,
      exampleKey: `TEMP`,
      context
    }),
    content: context.trace('content', () => toOptionalMediaTypeItemsV3({ content, context })),
    extensionFields
  }

  return new OasHeader(fields)
}
