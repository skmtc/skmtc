import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasDiscriminator } from '@/oas/discriminator/Discriminator.ts'
import { isEmpty } from '@/helpers/isEmpty.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/** A 3.2 Discriminator Object: the 3.0 shape plus `defaultMapping`. */
export type DiscriminatorObjectV32 = OpenAPIV3.DiscriminatorObject & { defaultMapping?: string }

export type ToDiscriminatorV3Args = {
  discriminator: DiscriminatorObjectV32 | undefined
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

  const { propertyName, mapping, defaultMapping, ...skipped } = discriminator

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
    mapping,
    defaultMapping
  })
}
