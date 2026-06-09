import type { BaseRegisterArgs, GenerateContextType } from '../../context/generateTypes.ts'
import type {
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelReturn
} from '../../context/generateTypes.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { Lang } from '@/dsl/Lang.ts'
import { langRegister } from '@/dsl/langRegister.ts'
import type { RefName } from '@/types/RefName.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { ModelProjection } from '@/dsl/model/types.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import type { Inserted } from '@/dsl/Inserted.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { OasVoid } from '@/oas/void/Void.ts'

/**
 * Constructor arguments for {@link ModelProjectionBase}.
 */
export type ModelProjectionBaseArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  generatorKey: GeneratorKey
  refName: RefName
  /** The target language. Injected by the `toModelProjectionBase` factory. */
  lang: Lang
}

/**
 * Runtime base class for model projections.
 *
 * A *projection* is a named, exportable artifact: the pipeline wraps its
 * value in a `Definition`, registers it in a `File`, and stitches in the
 * imports needed to reference it from elsewhere. User code extends this
 * class (typically via the `toModelProjectionBase` factory) and implements
 * `toString()` to produce the body of the definition.
 *
 * The static counterpart — the constructor type passed to
 * `context.insertModel(...)` — is {@link ModelProjection}.
 */
export class ModelProjectionBase<EnrichmentType = undefined> extends SnippetBase {
  settings: ContentSettings<EnrichmentType>
  refName: RefName
  override generatorKey: GeneratorKey
  /** The target language, injected by the factory from its `lang` config. */
  lang: Lang

  constructor({
    context,
    settings,
    generatorKey,
    refName,
    lang
  }: ModelProjectionBaseArgs<EnrichmentType>) {
    super({ context })

    this.generatorKey = generatorKey
    this.refName = refName
    this.settings = settings
    this.lang = lang
  }

  /**
   * Insert a related model and return its `Inserted` reference. The inserted
   * model is exported to this projection's own `exportPath` unless `noExport`
   * is set.
   *
   * Pass `{ variant }` to target a specific variant on the peer (e.g.
   * to thread `this.settings.variant` into a within-package sibling
   * Projection that's also variants-aware). Omitting it defaults to
   * the peer's `'main'` variant — the safe choice for variants-unaware
   * peers and the standard pattern for cross-package composition.
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
   * Insert a related model with reference normalization. If `schema` is a
   * `$ref`, the referenced name is used; otherwise `fallbackName` applies.
   *
   * `{ variant }` flows through the `$ref` branch only; for inline
   * schemas, bake the variant into `fallbackName` if you need
   * variant-distinct one-off Definitions.
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
