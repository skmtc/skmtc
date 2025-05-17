import { ModelDriver, toModelGeneratorKey, ValueBase } from '@skmtc/core'
import type { GenerateContext, Modifiers, RefName } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { ZodInsertable } from './ZodInsertable.ts'
import { zodConfig } from './config.ts'
type ConstructorProps = {
  context: GenerateContext
  destinationPath: string
  modifiers: Modifiers
  refName: RefName
  rootRef: RefName
}

export class ZodRef extends ValueBase {
  type = 'ref' as const
  modifiers: Modifiers
  name: string
  terminal: boolean
  constructor({ context, refName, destinationPath, modifiers, rootRef }: ConstructorProps) {
    super({ context, generatorKey: toModelGeneratorKey({ generatorId: zodConfig.id, refName }) })

    if (refName === rootRef && context.modelDepth[`${zodConfig.id}:${refName}`] > 0) {
      const settings = context.toModelContentSettings({
        refName,
        insertable: ZodInsertable,
      })



      this.name = settings.identifier.name
      this.modifiers = modifiers
      this.terminal = true
    } else {

    const zodDriver = new ModelDriver({
      context,
      refName,
      generation: 'force',
      destinationPath,
      rootRef,
      insertable: ZodInsertable,
    })

      this.name = zodDriver.settings.identifier.name
      this.modifiers = modifiers
      this.terminal = false
    }
  }

  override toString(): string {
    const out = applyModifiers(this.name, this.modifiers)
    return this.terminal ? `z.lazy(() => ${out})` : out
  }
}
