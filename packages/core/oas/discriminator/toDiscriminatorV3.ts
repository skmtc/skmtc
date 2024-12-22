import type { OpenAPIV3 } from 'npm:openapi-types@12.1.3'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasDiscriminator } from './Discriminator.ts'
import type { DiscriminatorFields } from './Discriminator.ts'

type ToDiscriminatorV3Args = {
  discriminator: OpenAPIV3.DiscriminatorObject | undefined
  context: ParseContext
}

export const toDiscriminatorV3 = ({
  discriminator,
  context
}: ToDiscriminatorV3Args): OasDiscriminator | undefined => {
  if (!discriminator) {
    return undefined
  }

  const { propertyName, ...skipped } = discriminator

  context.logSkippedFields(skipped)

  const fields: DiscriminatorFields = {
    propertyName
  }

  return new OasDiscriminator(fields)
}
