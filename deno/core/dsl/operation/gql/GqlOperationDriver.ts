import type { GqlOperationProjection } from './types.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalizeExportPath } from '@/helpers/normalizeExportPath.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { GeneratedDefinition } from '@/dsl/GeneratedValue.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { GenerateContextType, InsertGqlOperationArgs } from '@/context/generateTypes.ts'
import { toGqlOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
import { readProjectionOptions, toValueOptions } from '@/types/ProjectionOptions.ts'
import isEqual from 'lodash-es/isEqual'

/**
 * The `insertOperation` call plus the context. The Driver defaults
 * `variant` to `'main'` and `noExport` to `false`, and reads the caller's
 * options once for the identity statics and the constructor.
 */
type CreateGqlOperationArgs<
  V extends GeneratedValue,
  EnrichmentType = undefined,
  ProjectionOptions = undefined
> = InsertGqlOperationArgs<V, EnrichmentType, ProjectionOptions> & {
  context: GenerateContextType
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
export class GqlOperationDriver<
  V extends GeneratedValue,
  EnrichmentType = undefined,
  ProjectionOptions = undefined
> {
  context: GenerateContextType
  projection: GqlOperationProjection<V, EnrichmentType, ProjectionOptions>
  operation: GqlOperation
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V>
  noExport: boolean
  variant: string
  /** The caller's options, as passed to `insertOperation`. */
  options: ProjectionOptions

  constructor(args: CreateGqlOperationArgs<V, EnrichmentType, ProjectionOptions>) {
    const {
      context,
      projection,
      operation,
      destinationPath,
      noExport = false,
      variant = DEFAULT_VARIANT
    } = args

    this.context = context
    this.projection = projection
    this.operation = operation
    this.destinationPath = destinationPath
    this.noExport = noExport
    this.variant = variant
    this.options = readProjectionOptions<ProjectionOptions>(args)

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
      variant,
      options: this.options
    })

    this.definition = this.apply({ destinationPath })
  }

  private apply({ destinationPath }: ApplyArgs = {}): GeneratedDefinition<V> {
    const { identifier, exportPath } = this.settings

    const definition = this.getDefinition({ identifier, exportPath })

    if (
      destinationPath &&
      normalizeExportPath(exportPath) !== normalizeExportPath(destinationPath)
    ) {
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
    const normalizedPath = normalizeExportPath(path)

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
      settings: this.settings,
      options: this.options
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

    if (!(definition.value instanceof this.projection)) {
      return false
    }

    // Options are identity, like the variant, but cannot ride the key: a hit
    // is checked against the options its value was built with.
    const cachedOptions = toValueOptions(definition.value)

    if (!isEqual(cachedOptions, this.options)) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached options ${JSON.stringify(cachedOptions)} do not match new options ${JSON.stringify(this.options)}. Fold options into toIdentifierName.`
      )
    }

    return true
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

type AssertPeerSupportedArgs<
  V extends GeneratedValue,
  EnrichmentType = undefined,
  ProjectionOptions = undefined
> = {
  context: GenerateContextType
  projection: GqlOperationProjection<V, EnrichmentType, ProjectionOptions>
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
const assertPeerSupported = <
  V extends GeneratedValue,
  EnrichmentType = undefined,
  ProjectionOptions = undefined
>({
  context,
  projection,
  operation,
  variant
}: AssertPeerSupportedArgs<V, EnrichmentType, ProjectionOptions>): void => {
  const isSupported = projection.isSupported ?? (() => true)

  if (!isSupported({ operation, context, variant })) {
    const operationLabel = `${operation.rootKind} ${operation.fieldName}`
    throw new Error(
      `[${projection.id}] Cannot insert '${operationLabel}' — peer generator ` +
        `does not support this operation (isSupported returned false).`
    )
  }
}
