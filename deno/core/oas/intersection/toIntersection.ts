import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasIntersection } from './Intersection.ts'
import { toDiscriminatorV3 } from '../discriminator/toDiscriminatorV3.ts'
import { toSchemaV3 } from '../schema/toSchemasV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'

type ToIntersectionArgs = {
  value: OpenAPIV3.SchemaObject
  members: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[]
  context: ParseContext
}

export const toIntersection = ({
  value,
  members,
  context
}: ToIntersectionArgs): OasIntersection => {
  const { discriminator, title, description, nullable, ...skipped } = value

  const extensionFields = toSpecificationExtensionsV3({ skipped, context })

  return new OasIntersection({
    title,
    description,
    nullable,
    discriminator: context.trace('discriminator', () =>
      toDiscriminatorV3({ discriminator, context })
    ),
    members: members.map((schema, index) =>
      context.trace(`${index}`, () => toSchemaV3({ schema, context }))
    ),
    extensionFields
  })
}
