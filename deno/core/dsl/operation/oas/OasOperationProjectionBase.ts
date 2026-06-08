import type { OasOperationProjection } from '@/dsl/operation/oas/types.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type {
  DefineAndRegisterArgs,
  InsertOperationOptions,
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelReturn,
  BaseRegisterArgs,
  GenerateContextType
} from '@/context/generateTypes.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { Definition } from '@/dsl/Definition.ts'
import type { DefinitionBase, ToDefinitionArgs } from '@/dsl/Definition.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { ModelProjection } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'

/**
 * Constructor arguments for {@link OasOperationProjectionBase}.
 */
export type OasOperationProjectionBaseArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  generatorKey: GeneratorKey
  operation: OasOperation
}

/**
 * Runtime base class for OAS operation projections.
 *
 * The OAS analog of {@link ModelProjectionBase}: a *projection* whose
 * source is an `OasOperation` rather than a `RefName`. Subclasses produce
 * the body of a `Definition` and may compose other projections via
 * {@link insertModel}, {@link insertOperation}, and
 * {@link insertNormalizedModel}.
 *
 * The static counterpart — the constructor type passed to
 * `context.insertOperation(...)` — is {@link OasOperationProjection}.
 */
export class OasOperationProjectionBase<EnrichmentType = undefined> extends SnippetBase {
  settings: ContentSettings<EnrichmentType>
  operation: OasOperation
  override generatorKey: GeneratorKey

  constructor({
    context,
    generatorKey,
    settings,
    operation
  }: OasOperationProjectionBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.operation = operation
    this.settings = settings
  }

  /**
   * Insert a related operation. The inserted operation is exported to this
   * projection's own `exportPath` unless `noExport` is set.
   *
   * Pass `{ variant }` to target a specific variant on the peer (e.g.
   * to thread `this.settings.variant` into a within-package sibling
   * Projection that's also variants-aware). Omitting it defaults to
   * the peer's `'main'` variant — the safe choice for variants-unaware
   * peers and the standard pattern for cross-package composition.
   */
  insertOperation<V extends GeneratedValue, EnrichmentType = undefined>(
    projection: OasOperationProjection<V, EnrichmentType>,
    operation: OasOperation,
    options: Pick<InsertOperationOptions, 'noExport' | 'variant'> = {}
  ): Inserted<V, EnrichmentType> {
    return this.context.insertOperation({
      projection,
      operation,
      destinationPath: this.settings.exportPath,
      noExport: options.noExport,
      variant: options.variant
    })
  }

  /**
   * Insert a related model into this projection's export file.
   *
   * Pass `{ variant }` to target a specific variant on the peer model
   * projection. Omitting it defaults to the peer's `'main'` variant.
   */
  insertModel<V extends GeneratedValue, EnrichmentType = undefined>(
    projection: ModelProjection<V, EnrichmentType>,
    refName: RefName,
    options: Pick<InsertModelOptions, 'noExport' | 'variant'> = {}
  ): Inserted<V, EnrichmentType> {
    return this.context.insertModel(projection, refName, {
      destinationPath: this.settings.exportPath,
      noExport: options.noExport,
      variant: options.variant
    })
  }

  /**
   * Insert a related model with reference normalization. Useful for inline
   * request/response schemas where the schema may be either a `$ref` or a
   * concrete object.
   *
   * `{ variant }` flows through the `$ref` branch only; for inline
   * schemas, bake the variant into `fallbackName`.
   */
  insertNormalizedModel<
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType = undefined
  >(
    projection: ModelProjection<V, EnrichmentType>,
    { schema, fallbackName }: Omit<InsertNormalizedModelArgs<Schema>, 'destinationPath'>,
    options: Pick<InsertModelOptions, 'noExport' | 'variant'> = {}
  ): InsertNormalizedModelReturn<V, Schema> {
    return this.context.insertNormalizedModel(
      projection,
      {
        schema,
        fallbackName,
        destinationPath: this.settings.exportPath
      },
      {
        noExport: options.noExport,
        variant: options.variant
      }
    )
  }

  /**
   * @experimental
   * Define and register a one-off `Definition` in this projection's export
   * file without going through the standard insertion flow.
   */
  defineAndRegister<V extends GeneratedValue>({
    identifier,
    value,
    noExport
  }: Omit<DefineAndRegisterArgs<V>, 'destinationPath'>): Definition<V> {
    return this.context.defineAndRegister({
      identifier,
      value,
      destinationPath: this.settings.exportPath,
      noExport
    })
  }

  /**
   * Register imports/definitions in this projection's own export file.
   */
  override register(args: BaseRegisterArgs): void {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }

  /**
   * Wrap this projection's value in a `Definition`. The Driver calls this
   * instead of `new Definition(...)` so a language-bound projection base
   * can return its own `*Definition` subclass. Default: the core
   * {@link Definition} (byte-identical to the prior Driver behaviour).
   */
  toDefinition({ identifier, noExport }: ToDefinitionArgs): DefinitionBase<this> {
    return new Definition({ context: this.context, value: this, identifier, noExport })
  }
}
