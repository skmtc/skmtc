import { ModelDriver, toModelGeneratorKey } from '@skmtc/core'
import type { GenerateContextType, Modifiers, OasRef, OasSchema, RefName } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import { TypeboxProjection } from './TypeboxProjection.ts'
import denoJson from '../deno.json' with { type: 'json' }

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
        generatorId: denoJson.name,
        refName,
        variant: 'main'
      }),
      stackTrail: schema?.stackTrail.clone()
    })

    if (context.modelDepth[`${denoJson.name}:${refName}`] > 0) {
      // Back-reference to a model still open on the build stack: reuse its
      // settings instead of re-driving it, which would recurse forever.
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
