import { ModelDriver, toModelGeneratorKey } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, Modifiers, OasRef, OasSchema, RefName } from '@skmtc/core'
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
  terminal: boolean
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

    if (context.modelDepth[`${typeboxEntry.id}:${refName}`] > 0) {
      // A back-reference to a model still open on the build stack: a
      // recursive cycle. Resolve identity via `toModelContentSettings`
      // WITHOUT constructing the projection (which would recurse forever)
      // and reference the peer by name.
      context.modelDepth[`${typeboxEntry.id}:${refName}`]++

      const settings = context.toModelContentSettings({
        refName,
        projection: TypeboxProjection,
        variant: 'main'
      })

      this.register({
        imports: { '@sinclair/typebox': ['Type'] },
        destinationPath: settings.exportPath
      })

      this.name = settings.identifier.name
      this.modifiers = modifiers
      this.terminal = true
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
      this.modifiers = modifiers
      this.terminal = false
    }
  }

  override toString(): string {
    return applyModifiers(this.name, this.modifiers)
  }
}
