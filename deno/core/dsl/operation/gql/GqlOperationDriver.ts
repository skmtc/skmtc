import type { GqlOperationProjection } from './types.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import { Definition } from '@/dsl/Definition.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedDefinition } from '@/dsl/GeneratedValue.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { toGqlOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'

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
    variant
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
      // `verbatimModuleSyntax: true`.
      this.context.register({
        imports: { [exportPath]: [identifier.toImport()] },
        destinationPath
      })
    }

    return definition
  }

  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): Definition<V> {
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

    const definition = new Definition({
      context: this.context,
      value,
      identifier,
      noExport: this.noExport
    })

    this.context.register({
      definitions: [definition],
      destinationPath: exportPath
    })

    return definition
  }

  private affirmDefinition<V extends GeneratedValue>(
    definition: Definition | undefined,
    exportPath: string
  ): definition is Definition<V> {
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

  const opEnrichments: unknown = get(
    context.settings,
    `enrichments.${generatorId}.${operation.rootKind}.${operation.fieldName}`
  )

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
