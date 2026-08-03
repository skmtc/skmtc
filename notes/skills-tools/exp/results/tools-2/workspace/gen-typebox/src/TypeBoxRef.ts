import { ModelDriver, toModelGeneratorKey } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, Modifiers, OasRef, OasSchema, RefName } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { TypeBoxProjection } from './TypeBoxProjection.ts'
import { typeBoxEntry } from './mod.ts'

type ConstructorProps = {
  context: GenerateContextType
  destinationPath: string
  modifiers: Modifiers
  refName: RefName
  rootRef?: RefName
  /** The originating ref schema node — for fine-grained attribution. */
  schema?: OasSchema | OasRef<'schema'>
}

export class TypeBoxRef extends TsSnippet {
  type = 'ref' as const
  modifiers: Modifiers
  name: string

  constructor({ context, refName, destinationPath, modifiers, rootRef, schema }: ConstructorProps) {
    super({
      context,
      generatorKey: toModelGeneratorKey({
        generatorId: typeBoxEntry.id,
        refName,
        variant: 'main'
      }),
      stackTrail: schema?.stackTrail.clone()
    })

    if (context.modelDepth[`${typeBoxEntry.id}:${refName}`] > 0) {
      // A back-reference to a model still open on the build stack — a
      // recursive cycle. TypeBox cannot express a cross-constant lazy
      // reference (Type.Recursive only covers self-contained schemas), so
      // the peer is referenced by name; identity comes from
      // toModelContentSettings without materializing the projection.
      const settings = context.toModelContentSettings({
        refName,
        projection: TypeBoxProjection,
        variant: 'main'
      })

      this.register({
        imports: { '@sinclair/typebox': ['Type'] },
        destinationPath: settings.exportPath
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
    } else {
      const { settings } = new ModelDriver({
        context,
        refName,
        destinationPath,
        rootRef,
        projection: TypeBoxProjection,
        variant: 'main'
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
    }
  }

  override toString(): string {
    return applyModifiers(this.name, this.modifiers)
  }
}
