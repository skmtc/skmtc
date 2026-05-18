import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasUnknown } from './Unknown.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToUnknownArgs = {
  value: OpenAPIV3.SchemaObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toUnknown = ({ value, stackTrail, context }: ToUnknownArgs): OasUnknown => {
  const { type: _type, title, description, example, nullable, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    stackTrail,
    parentType: 'schema:unknown'
  })

  return context.withStackTrail(stackTrail, () =>
    new OasUnknown(
      {
        title,
        description,
        nullable,
        extensionFields,
        example
      },
      context
    )
  )
}
