import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.js'
import { OasDiscriminator } from './Discriminator.js'
import type { DiscriminatorFields } from './Discriminator.js'

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
