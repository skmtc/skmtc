import { ValueBase } from '@skmtc/core'
import type { GenerateContext, GeneratorKey, RefName } from '@skmtc/core'
import type { OasDiscriminator } from '@skmtc/core'
import type { OasSchema } from '@skmtc/core'
import type { OasRef } from '@skmtc/core'
import { toZodValue } from './Zod.ts'
import type { TypeSystemValue } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import type { Modifiers } from '@skmtc/core'

type ZodUnionArgs = {
  context: GenerateContext
  destinationPath: string
  members: (OasSchema | OasRef<'schema'>)[]
  discriminator?: OasDiscriminator
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef: RefName
}

export class ZodUnion extends ValueBase {
  type = 'union' as const
  members: TypeSystemValue[]
  discriminator: string | undefined
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, members, discriminator, modifiers, rootRef }: ZodUnionArgs) {
    super({ context, generatorKey })

    this.members = members.map((member) => {
      return toZodValue({ destinationPath, schema: member, required: true, context, rootRef })
    })

    this.discriminator = discriminator?.propertyName
    this.modifiers = modifiers
  }

  override toString(): string {
    const members = this.members.map((member) => `${member}`).join(', ')

    const content = this.discriminator
      ? `z.discriminatedUnion('${this.discriminator}', [${members}])`
      : `z.union([${members}])`

    return applyModifiers(content, this.modifiers)
  }
}
