import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasUnion } from './Union.ts'
import { toDiscriminatorV3 } from '../discriminator/toDiscriminatorV3.ts'
import { toSchemaV3 } from '../schema/toSchemasV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
type ToUnionArgs = {
  value: OpenAPIV3.SchemaObject
  members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
  parentType: 'anyOf' | 'oneOf'
  stackTrail: StackTrail
  context: ParseContextType
}

export const toUnion = ({
  value,
  members,
  parentType,
  stackTrail,
  context
}: ToUnionArgs): OasUnion => {
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
    stackTrail,
    parentType: `schema:${parentType}`
  })

  return new OasUnion({
    title,
    description,
    nullable,
    default: defaultValue,
    discriminator: stackTrail.trace('discriminator', st =>
      toDiscriminatorV3({ discriminator, stackTrail: st, context })
    ),
    members: members.reduce<(OasSchema | OasRef<'schema'>)[]>((acc, item, index) => {
      if (item === undefined || item === null) {
        return acc
      }

      return [
        ...acc,
        stackTrail.trace(`${index}`, st => toSchemaV3({ schema: item, stackTrail: st, context }))
      ]
    }, []),
    example,
    extensionFields
  })
}
