import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToDiscriminatorV3Args = {
  discriminator: OpenAPIV3.DiscriminatorObject | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toDiscriminatorV3 = ({
  discriminator,
  stackTrail,
  context
}: ToDiscriminatorV3Args): OasDiscriminator | undefined => {
  if (!discriminator) {
    return undefined
  }

  const { propertyName, mapping, ...skipped } = discriminator

  if (!isEmpty(skipped)) {
    context.logSkippedFields({
      skipped,
      parent: discriminator,
      parentType: 'discriminator',
      stackTrail
    })
  }

  return new OasDiscriminator({
    propertyName,
    mapping
  })
}
