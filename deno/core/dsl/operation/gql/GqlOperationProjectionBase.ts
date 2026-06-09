import type { GqlOperationProjection } from './types.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type {
  DefineAndRegisterArgs,
  InsertOperationOptions,
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelReturn,
  BaseRegisterArgs,
  GenerateContextType
} from '../../../context/generateTypes.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { Lang } from '@/dsl/Lang.ts'
import { langRegister } from '@/dsl/langRegister.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { ModelProjection } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'

/**
 * Constructor arguments for {@link GqlOperationProjectionBase}.
 */
export type GqlOperationProjectionBaseArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  generatorKey: GeneratorKey
  operation: GqlOperation
  /** The target language. Injected by the `toGqlOperationProjectionBase` factory. */
  lang: Lang
}

/**
 * Runtime base class for GraphQL operation projections.
 *
 * GraphQL analog of {@link OasOperationProjectionBase}: a *projection*
 * whose source is a `GqlOperation` (a root-field) rather than an
 * `OasOperation`. Subclasses produce the body of a `Definition` and may
 * compose other projections via {@link insertModel},
 * {@link insertOperation}, and {@link insertNormalizedModel}.
 *
 * The static counterpart — the constructor type passed to
 * `context.insertOperation(...)` — is {@link GqlOperationProjection}.
 */
export class GqlOperationProjectionBase<EnrichmentType = undefined> extends SnippetBase {
  settings: ContentSettings<EnrichmentType>
  operation: GqlOperation
  override generatorKey: GeneratorKey
  /** The target language, injected by the factory from its `lang` config. */
  lang: Lang

  constructor({
    context,
    generatorKey,
    settings,
    operation,
    lang
  }: GqlOperationProjectionBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.operation = operation
    this.settings = settings
    this.lang = lang
  }

  /**
   * Insert a related GraphQL operation. Exported to this projection's own
   * `exportPath` unless `noExport` is set.
   *
   * Pass `{ variant }` to target a specific variant on the peer
   * (e.g. to thread `this.settings.variant` into a within-package
   * sibling Projection that's also variants-aware). Omitting it
   * defaults to the peer's `'main'` variant.
   */
  insertOperation<V extends GeneratedValue, EnrichmentType = undefined>(
    projection: GqlOperationProjection<V, EnrichmentType>,
    operation: GqlOperation,
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
   * Insert a related model with reference normalization. Useful when the
   * operation's argument or return-type schema may be either a `$ref` or a
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
  }: Omit<DefineAndRegisterArgs<V>, 'destinationPath' | 'lang'>): DefinitionBase<V> {
    return this.context.defineAndRegister({
      identifier,
      value,
      destinationPath: this.settings.exportPath,
      noExport,
      lang: this.lang
    })
  }

  /**
   * Register imports/definitions in this projection's own export file.
   *
   * Converts the concise import form via `this.lang.toImports` and stores
   * through the agnostic `context.register` (the {@link langRegister}
   * helper) — the engine never names a concrete `File`.
   */
  register(args: BaseRegisterArgs): void {
    langRegister(this, { ...args, destinationPath: this.settings.exportPath })
  }
}
