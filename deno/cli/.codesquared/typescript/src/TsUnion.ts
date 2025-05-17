import { ValueBase } from '@skmtc/core'
import type { GenerateContext, GeneratorKey } from '@skmtc/core'
import type { OasDiscriminator } from '@skmtc/core'
import type { OasSchema } from '@skmtc/core'
import type { OasRef } from '@skmtc/core'
import { toTsValue } from './Ts.ts'
import type { TypeSystemValue } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import type { Modifiers } from '@skmtc/core'
import type { RefName } from '@skmtc/core'
type TsUnionArgs = {
  context: GenerateContext
  destinationPath: string
  members: (OasSchema | OasRef<'schema'>)[]
  discriminator?: OasDiscriminator
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef: RefName
}

export class TsUnion extends ValueBase {
  type = 'union' as const
  members: TypeSystemValue[]
  discriminator: string | undefined
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, members, discriminator, modifiers, rootRef }: TsUnionArgs) {
    super({ context, generatorKey })

    this.members = members.map((member) => {
      return toTsValue({
        destinationPath,
        schema: member,
        required: true,
        context,
        rootRef
      })
    })

    this.discriminator = discriminator?.propertyName
    this.modifiers = modifiers
  }

  override toString(): string {
    const members = this.members.map((member) => `${member}`).join(' | ')

    return applyModifiers(members, this.modifiers)
  }
}
