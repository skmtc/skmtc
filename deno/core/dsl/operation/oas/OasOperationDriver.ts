import type { OasOperationProjection } from './types.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedDefinition } from '@/dsl/GeneratedValue.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import { toOasOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { Lang } from '@/dsl/Lang.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

type CreateOperationArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  context: GenerateContextType
  projection: OasOperationProjection<V, EnrichmentType>
  operation: OasOperation
  destinationPath?: string
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
}

/**
 * Driver for the OAS operation insertion lifecycle.
 *
 * Resolves the projection's identifier and export path, looks up an
 * existing `Definition` in the target file, instantiates the projection
 * (constructing its value) when no cache hit exists, registers the new
 * definition, and stitches an import into `destinationPath` if it differs
 * from the projection's `exportPath`.
 */
export class OasOperationDriver<V extends GeneratedValue, EnrichmentType = undefined> {
  context: GenerateContextType
  projection: OasOperationProjection<V, EnrichmentType>
  operation: OasOperation
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V>
  noExport?: boolean
  variant: string
  /** The projection's language, resolved from the config map by `id`. */
  lang: Lang

  constructor({
    context,
    projection,
    operation,
    destinationPath,
    noExport,
    variant
  }: CreateOperationArgs<V, EnrichmentType>) {
    this.context = context
    this.projection = projection
    this.operation = operation
    this.destinationPath = destinationPath
    this.noExport = noExport
    this.variant = variant
    // The peer's language, read off the projection class (set by its
    // factory). No config-map lookup.
    this.lang = projection.lang

    assertPeerVariantExists({
      context,
      generatorId: projection.id,
      operation,
      variant
    })

    assertPeerSupported({ context, projection, operation })

    this.settings = this.context.toOperationContentSettings({
      operation,
      projection,
      variant
    })

    this.definition = this.apply({ destinationPath })
  }

  private apply({ destinationPath }: ApplyArgs = {}): GeneratedDefinition<V> {
    const { identifier, exportPath } = this.settings

    const definition = this.getDefinition({ identifier, exportPath })

    if (destinationPath && normalize(exportPath) !== normalize(destinationPath)) {
      // `Identifier.toImport()` carries the identifier's entity type so
      // type-only identifiers render as `import { type Foo }` under
      // `verbatimModuleSyntax: true`. The import lands in the caller's
      // file (`destinationPath`); `insertOperation` only composes
      // same-language generators, so the peer's `lang` is the caller's.
      this.context.register({
        imports: [this.lang.toImport({ identifier, module: exportPath })],
        destinationPath,
        createFile: path => this.lang.createFile({ path, settings: this.context.settings })
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
      context: this.context,
      operation: this.operation,
      settings: this.settings
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
      createFile: path => this.lang.createFile({ path, settings: this.context.settings })
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

    const currentKey = toOasOperationGeneratorKey({
      generatorId: this.projection.id,
      operation: this.operation,
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
  operation: OasOperation
  variant: string
}

/**
 * Guard the peer-variant-mismatch invariant.
 *
 * `'main'` is the universally-safe variant — it's guaranteed to be
 * present on every peer (the engine fills it when no enrichments are
 * configured, and the missing-`'main'` check throws when other
 * variants exist without it). So calls with `variant === 'main'`
 * always succeed regardless of the peer's enrichment shape.
 *
 * For any other variant, the peer's enrichment block at
 * `[generatorId][path][method]` must explicitly declare that variant
 * key. The Driver throws here — loud at the call site — rather than
 * letting silently-wrong output reach the consumer.
 */
const assertPeerVariantExists = ({
  context,
  generatorId,
  operation,
  variant
}: AssertPeerVariantExistsArgs): void => {
  if (variant === DEFAULT_VARIANT) {
    return
  }

  const opEnrichments: unknown = get(
    context.settings,
    `enrichments.${generatorId}.${operation.path}.${operation.method}`
  )

  const operationLabel = `${operation.method.toUpperCase()} ${operation.path}`

  if (opEnrichments === null || opEnrichments === undefined) {
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${operationLabel}' — ` +
        `peer has no enrichments configured. Only '${DEFAULT_VARIANT}' is permitted.`
    )
  }

  if (typeof opEnrichments !== 'object' || Array.isArray(opEnrichments)) {
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${operationLabel}' — ` +
        `peer enrichment is not a variant record.`
    )
  }

  if (!(variant in opEnrichments)) {
    const available = Object.keys(opEnrichments).join(', ')
    throw new Error(
      `[${generatorId}] Cannot insert variant '${variant}' for '${operationLabel}'. ` +
        `Available variants: ${available}.`
    )
  }
}

type AssertPeerSupportedArgs = {
  context: GenerateContextType
  projection: {
    id: string
    isSupported?: (args: { operation: OasOperation; context: GenerateContextType }) => boolean
  }
  operation: OasOperation
}

/**
 * Guard the peer-capability invariant.
 *
 * `insertOperation` materialises a peer's Definition regardless of the
 * peer's `skip` / `include` configuration — dependency edges are
 * intentionally filter-blind. Capability is different: a peer's
 * `isSupported` declares which operations it can serve *at all* (a
 * table generator cannot render an operation with no list response,
 * for example). Handing a peer an operation it has declared
 * unsupported would build a broken Definition or crash inside the
 * peer's constructor.
 *
 * The Driver throws here instead. The throw unwinds into
 * `GenerateContext`'s per-item `try/catch`, so the *calling*
 * generator's item is recorded as `error` and the run continues —
 * loud, isolated failure rather than silent broken output.
 *
 * A peer that exposes no static `isSupported` is treated as
 * supporting every operation: `toOasOperationProjectionBase` defaults
 * it to `() => true`, and a hand-rolled projection may omit it.
 */
const assertPeerSupported = ({
  context,
  projection,
  operation
}: AssertPeerSupportedArgs): void => {
  if (typeof projection.isSupported !== 'function') {
    return
  }

  if (!projection.isSupported({ operation, context })) {
    const operationLabel = `${operation.method.toUpperCase()} ${operation.path}`
    throw new Error(
      `[${projection.id}] Cannot insert '${operationLabel}' — peer generator ` +
        `does not support this operation (isSupported returned false).`
    )
  }
}
