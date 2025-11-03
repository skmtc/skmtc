import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasDiscriminator } from './Discriminator.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'

type ToDiscriminatorV3Args = {
  discriminator: OpenAPIV3.DiscriminatorObject | undefined
  context: ParseContextType
}

export const toDiscriminatorV3 = ({
  discriminator,
  context
}: ToDiscriminatorV3Args): OasDiscriminator | undefined => {
  if (!discriminator) {
    return undefined
  }

  const { propertyName, mapping, ...skipped } = discriminator

  if (!isEmpty(skipped)) {
    context.logSkippedFields({ skipped, parent: discriminator, parentType: 'discriminator' })
  }

  return new OasDiscriminator({
    propertyName,
    mapping
  })
}
