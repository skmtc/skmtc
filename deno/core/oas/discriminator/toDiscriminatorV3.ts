import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContext } from '../../context/ParseContext.ts'
import { OasDiscriminator } from './Discriminator.ts'

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

  const { propertyName, mapping, ...skipped } = discriminator

  context.logSkippedFields({ skipped, parent: discriminator, parentType: 'discriminator' })

  return new OasDiscriminator({
    propertyName,
    mapping
  })
}
