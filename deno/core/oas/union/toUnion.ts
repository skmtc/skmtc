import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasUnion } from './Union.ts'
import { toDiscriminatorV3 } from '../discriminator/toDiscriminatorV3.ts'
import { toSchemaV3 } from '../schema/toSchemasV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToUnionArgs = {
  value: OpenAPIV3.SchemaObject
  members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
  context: ParseContext
}

export const toUnion = ({ value, members, context }: ToUnionArgs): OasUnion => {
  const { discriminator, title, description, nullable, example, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: value,
    context
  })

  return new OasUnion({
    title,
    description,
    nullable,
    discriminator: context.trace('discriminator', () =>
      toDiscriminatorV3({ discriminator, context })
    ),
    members: members
      // .filter(item => item !== undefined && item !== null)
      .map((schema, index) => context.trace(`${index}`, () => toSchemaV3({ schema, context }))),
    example,
    extensionFields
  })
}
