import { ModelDriver, toModelGeneratorKey } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, Modifiers, RefName, StackTrail } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { EffectSchemaProjection } from './EffectSchemaProjection.ts'
import { EffectSchemaBase } from './base.ts'
import { EFFECT_MODULE, RECURSIVE_TYPE_NAME, SCHEMA } from './constants.ts'

type EffectRefArgs = {
  context: GenerateContextType
  destinationPath: string
  refName: RefName
  modifiers: Modifiers
  rootRef?: RefName
  stackTrail?: StackTrail
}

/**
 * A `$ref` renders as the referenced model's constant — defined exactly
 * once, in its own file, and imported here by the {@link ModelDriver}.
 *
 * The exception is a back-reference to a model still open on the build
 * stack: that is a recursive cycle, and it renders
 * `Schema.suspend((): Schema.Schema<any> => Name)` so the reference is
 * resolved lazily rather than read before initialization.
 */
export class EffectRef extends TsSnippet {
  type = 'ref' as const
  name: string
  modifiers: Modifiers
  /** Whether this reference closes a recursive cycle. */
  recursive: boolean

  constructor({ context, destinationPath, refName, modifiers, rootRef, stackTrail }: EffectRefArgs) {
    super({
      context,
      generatorKey: toModelGeneratorKey({ generatorId: EffectSchemaBase.id, refName }),
      stackTrail
    })

    this.modifiers = modifiers

    const depthKey = `${EffectSchemaBase.id}:${refName}`

    if (context.modelDepth[depthKey] > 0) {
      // A model still being built refers back to itself. Bump the depth so
      // the enclosing projection — whose own `resolveSchemaRefOnce` set this
      // key to 1 — detects the cycle as `> 1` and annotates its export with
      // `Schema.Schema<any>`, breaking TypeScript's circular inference.
      context.modelDepth[depthKey]++

      const settings = context.toModelContentSettings({
        refName,
        projection: EffectSchemaProjection
      })

      // The suspend wrapper is rendered into the referenced model's own
      // file, so that is where `Schema` must be in scope.
      this.register({
        imports: { [EFFECT_MODULE]: [SCHEMA] },
        destinationPath: settings.exportPath
      })

      this.name = settings.identifier.name
      this.recursive = true

      return
    }

    // Not a cycle: build (or reuse) the peer's Definition in its own file
    // and stitch an import of it into this file.
    const { settings } = new ModelDriver({
      context,
      refName,
      destinationPath,
      rootRef,
      projection: EffectSchemaProjection
    })

    this.name = settings.identifier.name
    this.recursive = false
  }

  override toString(): string {
    const reference = this.recursive
      ? `${SCHEMA}.suspend((): ${RECURSIVE_TYPE_NAME} => ${this.name})`
      : this.name

    return applyModifiers(reference, this.modifiers)
  }
}
