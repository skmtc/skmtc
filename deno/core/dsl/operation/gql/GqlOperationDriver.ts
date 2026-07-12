import type { GqlOperationProjection } from './types.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { GeneratedDefinition } from '@/dsl/GeneratedValue.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { toGqlOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'

type CreateGqlOperationArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  context: GenerateContextType
  projection: GqlOperationProjection<V, EnrichmentType>
  operation: GqlOperation
  destinationPath?: string
  noExport?: boolean
  /**
   * Target variant of the projection. The Driver resolves the
   * peer's enrichment for this variant, asserts the variant exists
   * (or is the default `'main'` which is always permitted), and
   * threads it into the projection's `ContentSettings`.
   * Optional — omitting it means `'main'`, so variants-unaware
   * callers keep working unchanged.
   */
  variant?: string
}

type ApplyArgs = {
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: IdentifierBase
  exportPath: string
}

/**
 * Driver for the GraphQL operation insertion lifecycle.
 *
 * GraphQL counterpart to {@link OasOperationDriver}: resolves the
 * projection's identifier and export path, looks up an existing
 * `Definition` in the target file, instantiates the projection when no
 * cache hit exists, registers the new definition, and stitches an import
 * into `destinationPath` if it differs from the projection's `exportPath`.
 */
export class GqlOperationDriver<V extends GeneratedValue, EnrichmentType = undefined> {
  context: GenerateContextType
  projection: GqlOperationProjection<V, EnrichmentType>
  operation: GqlOperation
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V>
  noExport?: boolean
  variant: string

  constructor({
    context,
    projection,
    operation,
    destinationPath,
    noExport,
    variant = DEFAULT_VARIANT
  }: CreateGqlOperationArgs<V, EnrichmentType>) {
    this.context = context
    this.projection = projection
    this.operation = operation
    this.destinationPath = destinationPath
    this.noExport = noExport
    this.variant = variant

    assertPeerVariantExists({
      context,
      generatorId: projection.id,
      operation,
      variant
    })

    assertPeerSupported({ context, projection, operation, variant })

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
      // Cross-file import of the peer's identifier from its export path.
      // The language builds the import object (`toImport`) and creates the
      // destination file on first write (caller-side); the engine stores
      // via the pure-data `context.register`. The import lands in the
      // caller's file (`destinationPath`); `insertOperation` only composes
      // same-language generators, so the peer's `lang` is the caller's.
      this.ensureFile(destinationPath)
      this.context.register({
        imports: [this.projection.lang.toImport({ identifier, module: exportPath })],
        destinationPath
      })
    }

    return definition
  }

  /**
   * Ensure the file at `path` exists, creating it on first write through
   * the projection's language — the static read off the projection class
   * at the use site, never persisted (works pre-construction on the
   * cache-hit path). Returns the normalized path.
   */
  private ensureFile(path: string): string {
    const normalizedPath = normalize(path)

    if (!this.context.getFile(normalizedPath)) {
      this.context.addFile(
        this.projection.lang.createFile({ path: normalizedPath, settings: this.context.settings })
      )
    }

    return normalizedPath
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

    const definition = this.projection.lang.toDefinition({
      context: this.context,
      identifier,
      value,
      noExport: this.noExport
    })

    this.ensureFile(exportPath)
    this.context.register({
      definitions: [definition],
      destinationPath: exportPath
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

    const currentKey = toGqlOperationGeneratorKey({
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
  operation: GqlOperation
  variant: string
}

/**
 * GraphQL counterpart to the OAS-side {@link assertPeerVariantExists}.
 * Same invariant: `'main'` is universally safe; any other variant
 * must be declared in the peer's enrichment block at
 * `[generatorId][rootKind][fieldName]`. See the OAS implementation
 * for the full rationale.
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

  const opEnrichments: unknown = context.readEnrichment([
    generatorId,
    operation.rootKind,
    operation.fieldName
  ])

  const operationLabel = `${operation.rootKind} ${operation.fieldName}`

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

type AssertPeerSupportedArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  context: GenerateContextType
  projection: GqlOperationProjection<V, EnrichmentType>
  operation: GqlOperation
  variant: string
}

/**
 * GraphQL counterpart to the OAS-side {@link assertPeerSupported}.
 *
 * Same invariant: cross-generator `insertOperation` bypasses
 * `skip` / `include` (dependency edges are filter-blind) but must
 * still honour `isSupported` — a peer cannot produce a valid
 * Definition for an operation it has declared unsupported. The Driver
 * throws so the calling generator's item is recorded as `error` by
 * `GenerateContext`'s per-item `try/catch`. A peer with no static
 * `isSupported` is treated as supporting every operation.
 */
const assertPeerSupported = <V extends GeneratedValue, EnrichmentType = undefined>({
  context,
  projection,
  operation,
  variant
}: AssertPeerSupportedArgs<V, EnrichmentType>): void => {
  const isSupported = projection.isSupported ?? (() => true)

  if (!isSupported({ operation, context, variant })) {
    const operationLabel = `${operation.rootKind} ${operation.fieldName}`
    throw new Error(
      `[${projection.id}] Cannot insert '${operationLabel}' — peer generator ` +
        `does not support this operation (isSupported returned false).`
    )
  }
}
