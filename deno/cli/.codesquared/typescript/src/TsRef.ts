import { ModelDriver, toModelGeneratorKey, ValueBase } from '@skmtc/core'
import type { GenerateContext, Modifiers, RefName } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { TsInsertable } from './TsInsertable.ts'
import { typescriptConfig } from './config.ts'

type TsRefConstructorProps = {
  context: GenerateContext
  destinationPath: string
  modifiers: Modifiers
  refName: RefName
  rootRef: RefName
}

export class TsRef extends ValueBase {
  type = 'ref' as const
  name: string
  modifiers: Modifiers
  terminal: boolean
  constructor({ context, refName, modifiers, destinationPath, rootRef }: TsRefConstructorProps) {
    super({ context, generatorKey: toModelGeneratorKey({ generatorId: typescriptConfig.id, refName }) })
    
    if (refName === rootRef && context.modelDepth[`${typescriptConfig.id}:${refName}`] > 0) {
      const settings = context.toModelContentSettings({
        refName,
        insertable: TsInsertable,
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
      this.terminal = true
    } else {

    const tsDriver = new ModelDriver({
      context,
      refName,
      generation: 'force',
      destinationPath,
      insertable: TsInsertable,
      rootRef
    })

    this.name = tsDriver.settings.identifier.name
    this.modifiers = modifiers
    this.terminal = false
    }
  }

  override toString(): string {
    return applyModifiers(this.name, this.modifiers)
  }
}
