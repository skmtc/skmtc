import { toExamplesV3 } from '../example/toExamplesV3.ts'
import { toRefV31 } from '../ref/toRefV31.ts'
import { toOptionalSchemaV3 } from '../schema/toSchemasV3.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { isRef } from '@/helpers/refFns.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toOptionalMediaTypeItemsV3 } from '../mediaType/toMediaTypeItemV3.ts'
import { OasHeader } from '@/oas/header/Header.ts'
import type { HeaderFields } from '@/oas/header/Header.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
export type ToHeadersV3Args = {
  headers: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.HeaderObject> | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toHeadersV3 = ({
  headers,
  stackTrail,
  context
}: ToHeadersV3Args): Record<string, OasHeader | OasRef<'header'>> | undefined => {
  if (!headers) {
    return undefined
  }

  const output: Record<string, OasHeader | OasRef<'header'>> = {}
  const entries = Object.entries(headers)

  for (const [key, value] of entries) {
    output[key] = stackTrail.trace(key, st =>
      toHeaderV3({ header: value, stackTrail: st, context })
    )
  }

  return output
}

export type ToHeaderV3Args = {
  header: OpenAPIV3.ReferenceObject | OpenAPIV3.HeaderObject
  stackTrail: StackTrail
  context: ParseContextType
}

const toHeaderV3 = ({
  header,
  stackTrail,
  context
}: ToHeaderV3Args): OasHeader | OasRef<'header'> => {
  if (isRef(header)) {
    return toRefV31({ ref: header, refType: 'header', stackTrail, context })
  }

  const { description, required, deprecated, schema, example, examples, content, ...skipped } =
    header

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: header,
    context,
    stackTrail,
    parentType: 'header'
  })

  const fields: HeaderFields = {
    description,
    required,
    deprecated,
    schema: stackTrail.trace('schema', st =>
      toOptionalSchemaV3({ schema, stackTrail: st, context })
    ),
    examples: toExamplesV3({
      examples,
      example,
      exampleKey: `TEMP`,
      stackTrail,
      context
    }),
    content: stackTrail.trace('content', st =>
      toOptionalMediaTypeItemsV3({ content, stackTrail: st, context })
    ),
    extensionFields
  }

  return new OasHeader(fields)
}
