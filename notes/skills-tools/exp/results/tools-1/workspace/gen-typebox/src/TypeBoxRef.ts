import { ModelDriver, toModelGeneratorKey } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, Modifiers, OasRef, OasSchema, RefName } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { TypeBoxProjection } from './TypeBoxProjection.ts'
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

export class TypeBoxRef extends TsSnippet {
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
      // recursive cycle. Bump the depth so the enclosing projection —
      // whose own `resolveSchemaRefOnce` set this key to 1 — can detect
      // recursion as `> 1` and widen its identifier annotation.
      // `ModelDriver` resets the key to 0 after the model finishes.
      context.modelDepth[`${typeboxEntry.id}:${refName}`]++

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
      this.terminal = true
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
      this.terminal = false
    }
  }

  override toString(): string {
    // TypeBox has no `lazy` wrapper — a terminal back-reference renders
    // the peer name directly; the enclosing projection's widened
    // `TSchema` annotation is what breaks TS's circular inference.
    return applyModifiers(this.name, this.modifiers)
  }
}
