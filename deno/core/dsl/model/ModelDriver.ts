import type { ModelProjection } from './types.ts'
import type { GenerateContextType } from '../../context/generateTypes.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedDefinition } from '../GeneratedValue.ts'
import type { GeneratedValue } from '../GeneratedValue.ts'
import type { RefName } from '@/types/RefName.ts'
import { toModelGeneratorKey } from '../GeneratorKeys.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

type CreateModelArgs<V extends GeneratedValue, EnrichmentType> = {
  context: GenerateContextType
  projection: ModelProjection<V, EnrichmentType>
  refName: RefName
  destinationPath?: string
  rootRef?: RefName
  noExport?: boolean
  /**
   * Target variant of the projection. The Driver resolves the
   * peer's enrichment for this variant, asserts the variant exists
   * (or is the default `'main'` which is always permitted), and
   * threads it into the projection's `ContentSettings`.
   */
  variant: string
}
type ApplyArgs = {
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: Identifier
  exportPath: string
  noExport?: boolean
}

/**
 * Driver for the model insertion lifecycle.
 *
 * Resolves the projection's identifier and export path, looks up an
 * existing `Definition` in the target file, instantiates the projection
 * (constructing its value) when no cache hit exists, registers the new
 * definition, and stitches an import into `destinationPath` if it differs
 * from the projection's `exportPath`.
 */
export class ModelDriver<V extends GeneratedValue, EnrichmentType> {
  context: GenerateContextType
  projection: ModelProjection<V, EnrichmentType>
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V>
  rootRef?: RefName
  noExport?: boolean
  variant: string
  /** The projection's language, resolved from the config map by `id`. */
  lang: Lang

  constructor({
    context,
    projection,
    refName,
    destinationPath,
    rootRef,
    noExport,
    variant
  }: CreateModelArgs<V, EnrichmentType>) {
    this.context = context
    this.projection = projection
    this.refName = refName
    this.destinationPath = destinationPath
    this.rootRef = rootRef
    this.noExport = noExport
    this.variant = variant
    // The peer's language, resolved by the engine from the peer's `id`
    // (the single source of truth). Works on cache-hit too — `id` is known
    // without constructing the value.
    this.lang = context.resolveLang(projection.id)

    this.context.modelDepth[`${projection.id}:${refName}`] = 0

    assertPeerVariantExists({
      context,
      generatorId: projection.id,
      refName,
      variant
    })

    this.settings = this.context.toModelContentSettings({ refName, projection, variant })
    this.definition = this.apply({ destinationPath })

    this.context.modelDepth[`${projection.id}:${refName}`] = 0
  }

  private apply({ destinationPath }: ApplyArgs = {}): GeneratedDefinition<V> {
    const { identifier, exportPath } = this.settings

    const definition = this.getDefinition({ identifier, exportPath })

    if (destinationPath && normalize(exportPath) !== normalize(destinationPath)) {
      // Cross-file import of the peer's identifier from its export path.
      // The language builds the import object (`toImport`); the engine
      // stores it via the agnostic `context.register`.
      this.context.register({
        imports: [this.lang.toImport({ identifier, module: exportPath })],
        destinationPath,
        generatorId: this.projection.id
      })
    }

    return definition
  }

  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): DefinitionBase<V> {
    const cachedDefinition = this.context.findDefinition({
      name: identifier.name,
      exportPath
    })

    if (this.affirmDefinition<V>(cachedDefinition, exportPath)) {
      return cachedDefinition
    }

    const value = new this.projection({
      refName: this.refName,
      context: this.context,
      settings: this.settings,
      destinationPath: this.settings.exportPath,
      rootRef: this.rootRef
    })

    const definition = this.lang.toDefinition({
      context: this.context,
      identifier,
      value,
      noExport: this.noExport
    })

    this.context.register({
      definitions: [definition],
      destinationPath: exportPath,
      generatorId: this.projection.id
    })

    return definition
  }

  private affirmDefinition<V extends GeneratedValue>(
    definition: DefinitionBase | undefined,
    exportPath: string
  ): definition is DefinitionBase<V> {
    if (!definition) {
      return false
    }

    const currentKey = toModelGeneratorKey({
      generatorId: this.projection.id,
      refName: this.refName,
      variant: this.settings.variant
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    return definition.value instanceof this.projection
  }
}

type AssertPeerVariantExistsArgs = {
  context: GenerateContextType
  generatorId: string
  refName: RefName
  variant: string
}

/**
 * Guard the peer-variant-mismatch invariant for model insertions.
 *
 * `'main'` is the universally-safe variant — it's guaranteed to be
 * present on every peer (the engine fills it when no enrichments are
 * configured, and the missing-`'main'` check throws when other
 * variants exist without it). So calls with `variant === 'main'`
 * always succeed regardless of the peer's enrichment shape.
 *
 * For any other variant, the peer's enrichment block at
 * `[generatorId][refName]` must explicitly declare that variant
 * key. The Driver throws here — loud at the call site — rather than
 * letting silently-wrong output reach the consumer.
 */
const assertPeerVariantExists = ({
  context,
  generatorId,
  refName,
  variant
}: AssertPeerVariantExistsArgs): void => {
  if (variant === DEFAULT_VARIANT) {
    return
  }

  const modelEnrichments: unknown = get(
    context.settings,
    `enrichments.${generatorId}.${refName}`
  )

  if (modelEnrichments === null || modelEnrichments === undefined) {
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${refName}' — ` +
        `peer has no enrichments configured. Only '${DEFAULT_VARIANT}' is permitted.`
    )
  }

  if (typeof modelEnrichments !== 'object' || Array.isArray(modelEnrichments)) {
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${refName}' — ` +
        `peer enrichment is not a variant record.`
    )
  }

  if (!(variant in modelEnrichments)) {
    const available = Object.keys(modelEnrichments).join(', ')
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${refName}'. ` +
        `Available variants: ${available}.`
    )
  }
}
