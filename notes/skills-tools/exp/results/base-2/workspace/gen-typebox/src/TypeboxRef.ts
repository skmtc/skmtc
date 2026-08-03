import { ModelDriver, toModelGeneratorKey } from '@skmtc/core'
import type { GenerateContextType, Modifiers, OasRef, OasSchema, RefName } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import { TypeboxProjection } from './TypeboxProjection.ts'
import { typeboxEntry } from './mod.ts'

type TypeboxRefArgs = {
  context: GenerateContextType
  destinationPath: string
  modifiers: Modifiers
  refName: RefName
  rootRef?: RefName
  schema?: OasSchema | OasRef<'schema'>
}

export class TypeboxRef extends TsSnippet {
  type = 'ref' as const
  modifiers: Modifiers
  name: string

  constructor({ context, refName, destinationPath, modifiers, rootRef, schema }: TypeboxRefArgs) {
    super({
      context,
      generatorKey: toModelGeneratorKey({
        generatorId: typeboxEntry.id,
        refName,
        variant: 'main'
      }),
      stackTrail: schema?.stackTrail.clone()
    })

    if (context.modelDepth[`${typeboxEntry.id}:${refName}`] > 0) {
      // Back-reference to a model still being built: don't re-enter the
      // driver (that would recurse forever); reference it by name.
      context.modelDepth[`${typeboxEntry.id}:${refName}`]++

      const settings = context.toModelContentSettings({
        refName,
        projection: TypeboxProjection,
        variant: 'main'
      })

      this.name = settings.identifier.name
    } else {
      const { settings } = new ModelDriver({
        context,
        refName,
        destinationPath,
        rootRef,
        projection: TypeboxProjection,
        variant: 'main'
      })

      this.name = settings.identifier.name
    }

    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers(this.name, this.modifiers)
  }
}
