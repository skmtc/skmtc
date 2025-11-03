import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasUnion } from './Union.ts'
import { toDiscriminatorV3 } from '../discriminator/toDiscriminatorV3.ts'
import { toSchemaV3 } from '../schema/toSchemasV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import { tracer } from '@/helpers/tracer.ts'
type ToUnionArgs = {
  value: OpenAPIV3.SchemaObject
  members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
  parentType: 'anyOf' | 'oneOf'
  context: ParseContextType
}

export const toUnion = ({ value, members, parentType, context }: ToUnionArgs): OasUnion => {
  const {
    discriminator,
    title,
    description,
    nullable,
    example,
    default: defaultValue,
    ...skipped
  } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context,
    parentType: `schema:${parentType}`
  })

  return new OasUnion({
    title,
    description,
    nullable,
    default: defaultValue,
    discriminator: tracer(context.stackTrail, 'discriminator', () =>
      toDiscriminatorV3({ discriminator, context })
    ),
    members: members.reduce<(OasSchema | OasRef<'schema'>)[]>((acc, item, index) => {
      if (item === undefined || item === null) {
        return acc
      }

      return [
        ...acc,
        tracer(context.stackTrail, `${index}`, () => toSchemaV3({ schema: item, context }))
      ]
    }, []),
    example,
    extensionFields
  })
}
