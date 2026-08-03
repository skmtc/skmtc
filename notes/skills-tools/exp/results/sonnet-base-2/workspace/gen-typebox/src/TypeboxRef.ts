import { ModelDriver, toModelGeneratorKey } from 'jsr:@skmtc/core@0.28.3'
import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import type { GenerateContextType, Modifiers, OasRef, OasSchema, RefName } from 'jsr:@skmtc/core@0.28.3'
import { applyModifiers } from './applyModifiers.ts'
import { TypeboxProjection } from './TypeboxProjection.ts'
import { typeboxEntry } from './mod.ts'

type ConstructorProps = {
  context: GenerateContextType
  destinationPath: string
  modifiers: Modifiers
  refName: RefName
  rootRef?: RefName
  /** The originating ref schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
}

export class TypeboxRef extends TsSnippet {
  type = 'ref' as const
  modifiers: Modifiers
  name: string

  constructor({ context, refName, destinationPath, modifiers, rootRef, schema }: ConstructorProps) {
    super({
      context,
      generatorKey: toModelGeneratorKey({
        generatorId: typeboxEntry.id,
        refName,
        variant: 'main'
      }),
      stackTrail: schema?.stackTrail.clone()
    })

    const { settings } = new ModelDriver({
      context,
      refName,
      destinationPath,
      rootRef,
      projection: TypeboxProjection,
      variant: 'main'
    })

    this.name = settings.identifier.name
    this.modifiers = modifiers
  }

  override toString(): string {
    return applyModifiers(this.name, this.modifiers)
  }
}
