import {
  applyGeneratedSuffix,
  camelCase,
  DEFAULT_GENERATED_SUFFIX,
  emptyEnrichmentSchema
} from '@skmtc/core'
import type {
  EmptyEnrichments,
  GenerateContextType,
  ModelProjectionConstructorArgs,
  RefName
} from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import { effectModule, generatorId } from './constants.ts'
import { toSchemaValue } from './toSchemaValue.ts'

/** The constant name a model is exported under — PascalCase of its `$ref` name. */
const toModelName = (refName: RefName): string => camelCase(refName, { upperFirst: true })

/** Every model lives in its own file; the engine appends the `.generated` suffix. */
const toModelExportPath = (refName: RefName): string => `@/models/${toModelName(refName)}.ts`

/**
 * Models whose value is mid-construction. A `$ref` back into this set closes
 * a cycle: the referenced constant is not yet defined, so it can only be
 * reached lazily, through `Schema.suspend`.
 */
const underConstruction = new Set<RefName>()

const base = toTsModelProjectionBase<EmptyEnrichments>({
  id: generatorId,
  toIdentifierName: ({ refName }) => toModelName(refName),
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ refName }) => toModelExportPath(refName),
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

/**
 * One effect `Schema` constant per OpenAPI component schema, each in its own
 * file. A `$ref` is never inlined — it resolves to the peer model's own
 * constant, imported from the peer's file, so a shared model (`Address`) is
 * defined exactly once no matter how many times it is referenced.
 */
export class EffectSchemaModel extends base {
  private value: string

  constructor(args: ModelProjectionConstructorArgs<EmptyEnrichments>) {
    super(args)

    const { context, refName } = args

    this.register({ imports: { [effectModule]: ['Schema'] } })

    // The expression standing in for a `$ref`.
    //
    // The straightforward case inserts the peer model — the engine builds it
    // (once) in its own file and stitches the import into this one — and the
    // expression is just its name.
    //
    // A reference into a model still being built would recurse forever, so it
    // is deferred with `Schema.suspend` instead. The self-recursive case needs
    // no import (the constant is in this very file); a longer cycle does, and
    // the peer's export path is derivable, so it is registered directly.
    const toRefValue = (peerRefName: RefName): string => {
      if (!underConstruction.has(peerRefName)) {
        return this.insertModel(EffectSchemaModel, peerRefName).toName()
      }

      const name = toModelName(peerRefName)

      if (peerRefName !== refName) {
        this.register({ imports: { [toSuffixedExportPath(peerRefName, context)]: [name] } })
      }

      return `Schema.suspend((): Schema.Schema<any> => ${name})`
    }

    underConstruction.add(refName)

    try {
      this.value = toSchemaValue(context.resolveSchemaRefOnce(refName, generatorId), toRefValue)
    } finally {
      underConstruction.delete(refName)
    }
  }

  override toString(): string {
    return this.value
  }
}

/**
 * The peer's export path as the engine stores it — the projection's declared
 * path with the project's generated-file suffix applied.
 */
const toSuffixedExportPath = (refName: RefName, context: GenerateContextType): string =>
  applyGeneratedSuffix(
    toModelExportPath(refName),
    context.settings?.generatedSuffix ?? DEFAULT_GENERATED_SUFFIX
  )
