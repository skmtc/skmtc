import { normalize } from '@std/path/normalize'
import { applyGeneratedSuffix, DEFAULT_GENERATED_SUFFIX } from '@/helpers/applyGeneratedSuffix.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { OasDocument } from '@/oas/document/Document.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import type { SkmtcParsedDocument } from '@/types/SkmtcDocument.ts'
import type { SupportedSubjects } from '@/types/SupportedSubjects.ts'
import type {
  EnrichmentDefaults,
  EnrichmentDefaultsLeaf,
  ModelEnrichmentDefaults,
  OperationEnrichmentDefaults,
  WebhookEnrichmentDefaults
} from '@/types/EnrichmentDefaults.ts'
import type {
  BuildModelSettingsArgs,
  GenerateContextType,
  GenerateResult,
  InsertGqlOperationArgs,
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelOptions,
  InsertNormalizedModelReturn,
  InsertOperationArgs,
  InsertWebhookArgs,
  PickArgs,
  ContextRegisterArgs,
  RegisterJsonArgs,
  RegisterMarkdownArgs,
  ToGqlOperationSettingsArgs,
  ToOperationSettingsArgs,
  ToWebhookSettingsArgs
} from './generateTypes.ts'
import type {
  ClientSettings,
  IncludeModelRefs,
  IncludeModels,
  IncludeOperations,
  IncludePaths,
  SkipModelRefs,
  SkipModels,
  SkipOperations,
  SkipPaths
} from '@/types/Settings.ts'
import type { Method } from '@/types/Method.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { OasWebhook } from '@/oas/webhook/Webhook.ts'
import { OasOperationDriver } from '@/dsl/operation/oas/OasOperationDriver.ts'
import { WebhookDriver } from '@/dsl/webhook/WebhookDriver.ts'
import { GqlOperationDriver } from '@/dsl/operation/gql/GqlOperationDriver.ts'
import { ModelDriver } from '@/dsl/model/ModelDriver.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import { ContentSettings } from '@/dsl/ContentSettings.ts'
import { DEFAULT_VARIANT } from '@/types/Variant.ts'
import { toVariantList } from '@/helpers/toVariantList.ts'
// @deno-types="npm:@types/lodash-es@4.17.12/get.d.ts"
import get from 'lodash-es/get'
import type { RefName } from '@/types/RefName.ts'
import type * as log from '@std/log'
import type { Logger } from '@/types/Logger.ts'
import type { ResultType } from '@/types/Results.ts'
import type { StackTrail } from './StackTrail.ts'
import type { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import type { SchemaToValueFn, SchemaType } from '@/types/TypeSystem.ts'
import { Inserted } from '@/dsl/Inserted.ts'
import type { CaptureChannel, CaptureSink } from '@/anchors/CaptureSink.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import { JsonFile } from '@/dsl/JsonFile.ts'
import { MarkdownFile } from '@/dsl/MarkdownFile.ts'
import invariant from 'tiny-invariant'
import type { GeneratorConfig, GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type {
  OasOperationSource,
  WebhookSource,
  GqlOperationSource,
  ModelSource,
  Preview,
  PreviewModule
} from '@/types/Preview.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { OasVoid } from '@/oas/void/Void.ts'
import type { WebhookEntry } from '@/dsl/webhook/toWebhookEntry.ts'
import type { OasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import type { GqlOperationEntry } from '@/dsl/operation/gql/toGqlOperationEntry.ts'
import type { ModelEntry } from '@/dsl/model/toModelEntry.ts'
import type { ModelProjection, NormalizedModelProjection } from '@/dsl/model/types.ts'
import { EnrichmentAudit, hasVariantEnrichment } from '@/enrichments/EnrichmentAudit.ts'
import { formatEnrichmentPath, type EnrichmentWarning } from '@/enrichments/EnrichmentWarning.ts'

type ConstructorArgs = {
  /**
   * Source document for generation, wrapped in the {@link SkmtcParsedDocument}
   * discriminated union. Generators that target a specific protocol
   * narrow on `document.type` to access the underlying `OasDocument` or
   * `GqlDocument` via `document.value`.
   */
  document: SkmtcParsedDocument
  settings: ClientSettings | undefined
  logger: log.Logger
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  /**
   * Shared attribution capture channel — the slot `RenderContext` flips to
   * open/close the capture interval. Snippets read it through this
   * context's {@link GenerateContext.captureSink}. Optional: when omitted
   * (tests, capture-less runs) `captureSink` is always `undefined`.
   */
  captureChannel?: CaptureChannel
}

/**
 * Arguments for applying package imports to a generated file.
 *
 * Used to configure import statements and dependencies when generating
 * code files that need to reference external packages or modules.
 */
export type ApplyPackageImportsArgs = {
  /** The destination file path where imports should be applied */
  destinationPath: string
  /** The export path for the module being imported */
  exportPath: string
}

/**
 * Arguments for creating and registering a definition from a schema.
 *
 * Used to transform OpenAPI schema objects into code definitions and
 * register them in the generation context for output file creation.
 *
 * @template Schema - The schema type extending SchemaType
 */
export type CreateAndRegisterDefinition<Schema extends SchemaType> = {
  /** The OpenAPI schema to transform into a definition */
  schema: Schema
  /** The identifier for the generated definition */
  identifier: IdentifierBase
  /** The destination file path where the definition should be registered */
  destinationPath: string
  /** Function to transform the schema into a generated value */
  schemaToValueFn: SchemaToValueFn
  /** Optional root reference name for the schema */
  rootRef?: RefName
  /** Whether to exclude this definition from exports */
  noExport?: boolean
}

/**
 * Arguments for retrieving operation-specific settings.
 *
 * Used to get generator-specific configuration for a particular
 * OpenAPI operation based on its path and HTTP method.
 */
export type GetOperationSettingsArgs = {
  /** The ID of the generator requesting settings */
  generatorId: string
  /** The API path for the operation */
  path: string
  /** The HTTP method for the operation */
  method: Method
}

/**
 * Arguments for adding render dependencies for an operation.
 *
 * Used to specify additional dependencies that should be included
 * when rendering code for a specific OpenAPI operation.
 */
export type AddRenderDependencyArgs = {
  /** The ID of the generator adding dependencies */
  generatorId: string
  /** The OpenAPI operation requiring dependencies */
  operation: OasOperation
  /** Array of dependency names or paths to include */
  dependencies: string[]
}

/**
 * Arguments for retrieving model-specific settings.
 *
 * Used to get generator-specific configuration for a particular
 * OpenAPI model based on its reference name.
 */
export type ToModelSettingsArgs = {
  /** The ID of the generator requesting model settings */
  generatorId: string
  /** The reference name of the model */
  refName: RefName
}

/**
 * Return type for insert operations in the generation context.
 *
 * Represents the result of inserting content into the generation
 * context, providing type-safe access to the inserted content.
 *
 * @template V - The generated value type
 * @template T - The generation type
 * @template EnrichmentType - The enrichment data type
 */
export type InsertReturn<V extends GeneratedValue, EnrichmentType> = Inserted<V, EnrichmentType>

/**
 * The generation context for the second phase of the SKMTC transformation pipeline.
 *
 * `GenerateContext` manages the transformation of parsed OAS (OpenAPI Schema) objects
 * into code artifacts using pluggable generators. It provides APIs for model and operation
 * generation, file management, dependency tracking, and artifact registration.
 *
 * ## Key Responsibilities
 *
 * - **Generator Orchestration**: Executes pluggable model and operation generators
 * - **Schema Processing**: Provides utilities for working with OAS schemas and references
 * - **File Management**: Handles file creation, imports, exports, and dependencies
 * - **Artifact Registration**: Collects generated definitions and files for rendering
 * - **Type System Integration**: Bridges OAS types with generator-specific type systems
 * - **Settings Management**: Handles skipping logic and client customizations
 *
 * ## Generator Integration
 *
 * The context works with two main types of generators:
 * - **Model Generators**: Transform schema definitions into type definitions
 * - **Operation Generators**: Transform API operations into client functions
 *
 * @example Basic usage in a model generator
 * ```typescript
 * import { ModelProjectionBase } from '@skmtc/core';
 *
 * class TypeScriptInterface extends ModelProjectionBase {
 *   generate(): Definition {
 *     const schema = this.context.getSchema(this.refName);
 *
 *     return new Definition({
 *       context: this.context,
 *       identifier: createType(this.refName),
 *       description: schema.description,
 *       value: {
 *         generatorKey: this.generatorKey,
 *         content: this.generateInterfaceBody(schema)
 *       }
 *     });
 *   }
 * }
 * ```
 */

const isGqlInsertOperationArgs = <V extends GeneratedValue, EnrichmentType>(
  args: InsertOperationArgs<V, EnrichmentType>
): args is InsertGqlOperationArgs<V, EnrichmentType> => args.operation.oasType === 'gqlOperation'

const isGqlToOperationSettingsArgs = <V extends GeneratedValue, EnrichmentType>(
  args: ToOperationSettingsArgs<V, EnrichmentType>
): args is ToGqlOperationSettingsArgs<V, EnrichmentType> =>
  args.operation.oasType === 'gqlOperation'

/** A non-null object — the subject-scope leaf of an enrichment-defaults umbrella
 *  (`{ fields, title, … }`). Narrows `unknown` without an `as` cast. */
const isEnrichmentLeaf = (value: unknown): value is EnrichmentDefaultsLeaf =>
  typeof value === 'object' && value !== null

export class GenerateContext implements GenerateContextType {
  #files: Map<string, FileBase>
  #previews: Record<string, Preview>
  /**
   * Parsed source document, wrapped in the {@link SkmtcParsedDocument}
   * discriminated union. Canonical representation; both protocol-neutral
   * (model) and protocol-specific (operation) dispatch reads through this.
   */
  document: SkmtcParsedDocument
  /** Client settings for customization (optional) */
  settings: ClientSettings | undefined
  /** Logger instance for tracking generation progress */
  logger: Logger
  /** Function to capture processing results at current stack position */
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void
  /** Function that returns the generator configuration map */
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>

  /** Tracking model nesting depth to prevent infinite recursion */
  modelDepth: Record<string, number>
  /**
   * Creates a new GenerateContext instance for the generation phase.
   *
   * @param args - Constructor arguments including document, settings, and handlers
   */
  /** Shared attribution capture channel (see {@link ConstructorArgs}). */
  #captureChannel: CaptureChannel | undefined

  /**
   * Records every enrichment lookup during the walk; finalized into
   * `enrichmentWarnings` at the end of {@link toArtifacts}.
   */
  #enrichmentAudit: EnrichmentAudit

  constructor({
    document,
    settings,
    logger,
    captureCurrentResult,
    toGeneratorConfigMap,
    captureChannel
  }: ConstructorArgs) {
    this.logger = logger
    this.#files = new Map()
    this.#previews = {}
    this.document = document
    this.settings = settings
    this.captureCurrentResult = captureCurrentResult
    this.toGeneratorConfigMap = toGeneratorConfigMap
    this.modelDepth = {}
    this.#captureChannel = captureChannel
    this.#enrichmentAudit = new EnrichmentAudit()
  }

  /**
   * The recording enrichment accessor — the single choke point every
   * enrichment lookup routes through (dispatch loops, projection-base
   * `toEnrichments`, the Drivers' peer-variant guards). Segments are
   * literal keys (the array form of `get` keeps dotted paths intact);
   * the read is recorded so the post-walk consumption audit can flag
   * configured entries no lookup ever touched.
   */
  readEnrichment(segments: readonly string[]): unknown {
    // Recording only matters when there is config to audit — on the common
    // no-enrichment run, skip the bookkeeping entirely (finalize would
    // early-return anyway, so the consumed sets would be pure waste).
    if (this.settings?.enrichments !== undefined) {
      this.#enrichmentAudit.consume(segments)
    }
    return get(this.settings, ['enrichments', ...segments])
  }

  /** Add a warning to this run's enrichment audit (deduplicated). */
  reportEnrichmentWarning(warning: EnrichmentWarning): void {
    this.#enrichmentAudit.report(warning)
  }

  /**
   * Emit the `SKIPPED_SUBJECT_ENRICHMENT` info line when a skip/include
   * filter excludes an item the consumer wrote an enrichment for. Info,
   * not warning: the entry is addressed correctly, and a temporary skip
   * must not read as dead config.
   */
  #reportSkippedEnrichment(block: unknown, variant: string, path: readonly string[]): void {
    if (!hasVariantEnrichment(block, variant)) return

    this.#enrichmentAudit.report({
      level: 'info',
      type: 'SKIPPED_SUBJECT_ENRICHMENT',
      path,
      message:
        `enrichment at '${formatEnrichmentPath(path)}' targets a skipped item — ` +
        `it was not applied in this run`
    })
  }

  /**
   * The active attribution capture sink, or `undefined` outside the
   * capture interval. Every `SnippetBase` instance's `toString` wrapper
   * reads this; `RenderContext` opens/closes the interval by flipping the
   * shared channel's `sink`.
   */
  get captureSink(): CaptureSink | undefined {
    return this.#captureChannel?.sink
  }

  /**
   * @internal
   */
  toArtifacts(stackTrail: StackTrail): GenerateResult {
    const generators: GeneratorConfig[] = Object.values(this.toGeneratorConfigMap())

    generators.forEach(generatorConfig => {
      stackTrail.trace(generatorConfig.id, st => {
        // Whole-generator skip (string entry in `skip`). Silent no-op:
        // no per-operation `skipped` results emitted.
        if (this.settings?.skip?.includes(generatorConfig.id)) {
          return
        }

        // `include` is per-generator, not document-global. A generator
        // with a per-operation include slice runs in allow-list mode
        // (only the listed operations); a generator absent from
        // `include` is unaffected and runs default-on. There is
        // therefore no whole-generator include gate here — the slice
        // extracted below is applied per-operation in the run* arms.
        // (Whole-generator opt-out is `skip`. A bare-string `include`
        // entry carries no per-operation filter and is a no-op.)

        const skip: SkipOperations | SkipModels | undefined = this.settings?.skip?.find(
          (skip): skip is SkipOperations | SkipModels => {
            return typeof skip === 'object' && Boolean(skip[generatorConfig.id])
          }
        )

        // Extract the per-generator include slice (if any). Same
        // dispatch shape as skip: object entries get matched by key,
        // string entries don't produce a per-op filter (they mean
        // "everything from this generator is included", which is
        // semantically equivalent to "no per-op filter" once the
        // whole-generator gate above has admitted us).
        const include: IncludeOperations | IncludeModels | undefined = this.settings?.include?.find(
          (entry): entry is IncludeOperations | IncludeModels => {
            return typeof entry === 'object' && Boolean(entry[generatorConfig.id])
          }
        )

        switch (generatorConfig.type) {
          case 'oasOperation':
            if (this.document.type !== 'oas') {
              // Generator targets OAS; current document is GraphQL — skip silently.
              return
            }
            this.#runOasOperationGenerator(
              this.document.value,
              generatorConfig,
              toIncludePaths(include, generatorConfig.id),
              toSkipPaths(skip, generatorConfig.id),
              st
            )
            break
          case 'webhook':
            if (this.document.type !== 'oas') {
              // Webhooks are an OAS 3.1 feature; current document is GraphQL —
              // skip silently.
              return
            }
            this.#runWebhookGenerator(
              this.document.value,
              generatorConfig,
              toIncludePaths(include, generatorConfig.id),
              toSkipPaths(skip, generatorConfig.id),
              st
            )
            break
          case 'gqlOperation':
            if (this.document.type !== 'gql') {
              // Generator targets GraphQL; current document is OAS — skip silently.
              return
            }
            // GraphQL operations don't yet have skip/include support
            // at the per-operation level. The whole-generator gate
            // above does apply (so `include: ['my-gql-gen']` works as
            // expected), but per-(rootKind, fieldName) filtering is a
            // follow-up that needs the same dispatch shape added for
            // GqlOperation. Tracked alongside the existing GQL-skip
            // gap.
            this.#runGqlOperationGenerator(this.document.value, generatorConfig, st)
            break
          case 'model':
            this.#runModelGenerator(
              this.document,
              generatorConfig,
              toIncludeModels(include, generatorConfig.id),
              toSkipModels(skip, generatorConfig.id),
              st
            )
            break
          default: {
            const _exhaustive: never = generatorConfig
            throw new Error(`Invalid generator type: ${JSON.stringify(_exhaustive)}`)
          }
        }
      })
    })

    // Post-walk consumption audit: every enrichment lookup above was
    // recorded; configured paths no lookup touched are dead config —
    // typo'd ids / paths / methods / model names, or entries orphaned by
    // spec evolution. Warn-level, fail-open.
    const enrichmentWarnings = this.#enrichmentAudit.finalize({
      enrichments: this.settings?.enrichments,
      generators: generators.map(({ id, type }) => ({ id, type })),
      skippedGeneratorIds: (this.settings?.skip ?? []).filter(
        (entry): entry is string => typeof entry === 'string'
      )
    })

    return {
      files: this.#files,
      previews: this.#previews,
      enrichmentWarnings
    }
  }

  /**
   * Evaluate each generator's `isSupported` over the parsed document's subjects
   * and report the subjects each generator supports — capability only, no
   * transform and no render. Operation generators report the operations their
   * `isSupported` accepts; model generators report the models theirs accepts
   * (a generator that declares no `isSupported` defaults to every subject). A
   * generator targeting the other protocol reports nothing.
   */
  toSupportedSubjects(): SupportedSubjects {
    const generators: GeneratorConfig[] = Object.values(this.toGeneratorConfigMap())
    const out: SupportedSubjects = {}

    generators.forEach(generatorConfig => {
      switch (generatorConfig.type) {
        case 'oasOperation': {
          const operations =
            this.document.type === 'oas'
              ? this.document.value.operations
                  .filter(operation =>
                    generatorConfig.isSupported({
                      operation,
                      context: this,
                      variant: DEFAULT_VARIANT
                    })
                  )
                  .map(operation => ({ path: operation.path, method: operation.method }))
              : []
          out[generatorConfig.id] = { type: 'oasOperation', operations }
          break
        }
        case 'webhook': {
          const webhooks =
            this.document.type === 'oas'
              ? this.document.value.webhooks
                  .filter(webhook =>
                    generatorConfig.isSupported({
                      webhook,
                      context: this,
                      variant: DEFAULT_VARIANT
                    })
                  )
                  .map(webhook => ({ name: webhook.name, method: webhook.method }))
              : []
          out[generatorConfig.id] = { type: 'webhook', webhooks }
          break
        }
        case 'gqlOperation': {
          const operations =
            this.document.type === 'gql'
              ? this.document.value.operations
                  .filter(operation =>
                    generatorConfig.isSupported({
                      operation,
                      context: this,
                      variant: DEFAULT_VARIANT
                    })
                  )
                  .map(operation => ({
                    rootKind: operation.rootKind,
                    fieldName: operation.fieldName
                  }))
              : []
          out[generatorConfig.id] = { type: 'gqlOperation', operations }
          break
        }
        case 'model': {
          const models = this.#schemaRefNames().filter(refName =>
            generatorConfig.isSupported({ refName, context: this, variant: DEFAULT_VARIANT })
          )
          out[generatorConfig.id] = { type: 'model', models }
          break
        }
        default: {
          const _exhaustive: never = generatorConfig
          throw new Error(`Invalid generator type: ${JSON.stringify(_exhaustive)}`)
        }
      }
    })

    return out
  }

  /**
   * Every component / registry schema refName in the document, as a flat array.
   * Exhaustive over the document protocol — a new schema type is a compile error
   * here rather than silently falling into the wrong branch.
   */
  #schemaRefNames(): RefName[] {
    switch (this.document.type) {
      case 'oas':
        return [...(this.document.value.components?.toSchemasRefNames() ?? [])]
      case 'gql':
        return [...this.document.value.registry.toSchemasRefNames()]
      default: {
        const _exhaustive: never = this.document
        throw new Error(`Unhandled document type: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  /**
   * The seed enrichment values each configured generator derives from the
   * document — the *values* counterpart of {@link toSupportedSubjects}. For
   * every generator that advertises `toEnrichmentDefaults`, calls it over the
   * subjects the generator supports and keeps the non-`undefined` subject-scope
   * leaves, keyed by the `client.json#settings.enrichments` routing:
   * `[id][path][method]['main']` for operations, `[id][refName]['main']` for
   * models. Seeding targets the `'main'` variant; a generator that advertises
   * no defaults (or whose every subject returns `undefined`) is omitted.
   *
   * Like {@link toSupportedSubjects} it neither transforms nor renders, and is
   * defensive: a generator whose hook throws contributes nothing rather than
   * failing the whole pass.
   */
  toEnrichmentDefaults(): EnrichmentDefaults {
    const generators: GeneratorConfig[] = Object.values(this.toGeneratorConfigMap())
    const out: EnrichmentDefaults = {}

    generators.forEach(generatorConfig => {
      switch (generatorConfig.type) {
        case 'oasOperation': {
          const toDefaults = generatorConfig.toEnrichmentDefaults
          if (!toDefaults || this.document.type !== 'oas') break

          const operations: OperationEnrichmentDefaults = {}
          this.document.value.operations.forEach(operation => {
            if (
              !generatorConfig.isSupported({ operation, context: this, variant: DEFAULT_VARIANT })
            ) {
              return
            }

            const leaf = this.#subjectDefaults(() =>
              toDefaults({ operation, context: this, variant: DEFAULT_VARIANT })
            )
            if (leaf === undefined) return

            const methods = (operations[operation.path] ??= {})
            methods[operation.method] = { [DEFAULT_VARIANT]: leaf }
          })

          if (Object.keys(operations).length > 0) {
            out[generatorConfig.id] = operations
          }
          break
        }
        case 'webhook': {
          const toDefaults = generatorConfig.toEnrichmentDefaults
          if (!toDefaults || this.document.type !== 'oas') break

          const webhooks: WebhookEnrichmentDefaults = {}
          this.document.value.webhooks.forEach(webhook => {
            if (
              !generatorConfig.isSupported({ webhook, context: this, variant: DEFAULT_VARIANT })
            ) {
              return
            }

            const leaf = this.#subjectDefaults(() =>
              toDefaults({ webhook, context: this, variant: DEFAULT_VARIANT })
            )
            if (leaf === undefined) return

            const methods = (webhooks[webhook.name] ??= {})
            methods[webhook.method] = { [DEFAULT_VARIANT]: leaf }
          })

          if (Object.keys(webhooks).length > 0) {
            out[generatorConfig.id] = webhooks
          }
          break
        }
        case 'model': {
          const toDefaults = generatorConfig.toEnrichmentDefaults
          if (!toDefaults) break

          // Seed only the models the generator supports — mirrors the
          // operation arm. A generator that declares no `isSupported`
          // defaults to every model; the hook itself still returns
          // `undefined` for schemas it doesn't seed.
          const models: ModelEnrichmentDefaults = {}
          for (const refName of this.#schemaRefNames()) {
            if (
              !generatorConfig.isSupported({ refName, context: this, variant: DEFAULT_VARIANT })
            ) {
              continue
            }

            const leaf = this.#subjectDefaults(() =>
              toDefaults({ refName, context: this, variant: DEFAULT_VARIANT })
            )
            if (leaf === undefined) continue

            models[refName] = { [DEFAULT_VARIANT]: leaf }
          }

          if (Object.keys(models).length > 0) {
            out[generatorConfig.id] = models
          }
          break
        }
        case 'gqlOperation': {
          // No `toEnrichmentDefaults` on the GraphQL projection base — seeding is
          // OAS-operation / model only today, so a GQL generator contributes
          // nothing.
          break
        }
        default: {
          const _exhaustive: never = generatorConfig
          throw new Error(`Invalid generator type: ${JSON.stringify(_exhaustive)}`)
        }
      }
    })

    return out
  }

  /**
   * Run a generator's `toEnrichmentDefaults` defensively and extract its
   * subject-scope leaf. A throwing hook contributes nothing; an umbrella with no
   * `subject` (or a non-object `subject`) is treated as "no default for this
   * subject". The run-constant `generator` / `stack` scopes are intentionally
   * ignored — seeding is subject-scope only.
   */
  #subjectDefaults(produce: () => unknown): EnrichmentDefaultsLeaf | undefined {
    try {
      const umbrella = produce()
      if (typeof umbrella !== 'object' || umbrella === null || !('subject' in umbrella)) {
        return undefined
      }
      const { subject } = umbrella
      return isEnrichmentLeaf(subject) ? subject : undefined
    } catch (error) {
      this.logger.error(error)
      return undefined
    }
  }

  #runOasOperationGenerator(
    oasDocument: OasDocument,
    generatorConfig: OasOperationEntry,
    include: IncludePaths | undefined,
    skip: SkipPaths | undefined,
    stackTrail: StackTrail
  ) {
    oasDocument.operations.forEach(operation => {
      stackTrail.trace(`${operation.path}:${operation.method}`, opTrail => {
        // Resolve the variant list to fan out over. The consumer's
        // enrichments are keyed `[generatorId][path][method][variant]`;
        // the block at `[path][method]` is therefore a record of
        // variant names. Three cases handled in `toVariantList`:
        //
        //   - absent → run a single 'main' pass with no enrichment
        //   - present, non-object → treat as a single 'main' pass
        //     (the per-variant Valibot wrap will reject this shape
        //     at config-load time once it lands)
        //   - present, object → enumerate keys; 'main' must be among
        //     them or we throw (loud beats silent zero-output)
        const opEnrichments: unknown = this.readEnrichment([
          generatorConfig.id,
          operation.path,
          operation.method
        ])

        const variants = toVariantList({
          opEnrichments,
          generatorId: generatorConfig.id,
          operationLabel: `${operation.method.toUpperCase()} ${operation.path}`
        })

        variants.forEach(variant => {
          opTrail.trace(`variant: ${variant}`, st => {
            try {
              if (
                typeof generatorConfig?.isSupported === 'function' &&
                !generatorConfig.isSupported({ operation, context: this, variant })
              ) {
                this.captureCurrentResult('notSupported', st)
                return
              }

              // Order: isSupported (capability) → include (allow) → skip
              // (deny). Match is now on `(path, method, variant)`. An
              // empty variant array on a method means "every variant of
              // this method"; a populated array names the variants the
              // entry applies to.
              if (
                include !== undefined &&
                !matchesPathFilter({
                  paths: include,
                  path: operation.path,
                  method: operation.method,
                  variant
                })
              ) {
                this.#reportSkippedEnrichment(opEnrichments, variant, [
                  generatorConfig.id,
                  operation.path,
                  operation.method,
                  variant
                ])
                this.captureCurrentResult('skipped', st)
                return
              }

              if (
                matchesPathFilter({
                  paths: skip,
                  path: operation.path,
                  method: operation.method,
                  variant
                })
              ) {
                this.#reportSkippedEnrichment(opEnrichments, variant, [
                  generatorConfig.id,
                  operation.path,
                  operation.method,
                  variant
                ])
                this.captureCurrentResult('skipped', st)
                return
              }

              generatorConfig.transform({
                context: this,
                operation,
                variant
              })

              const source = toOasOperationSource({
                operation,
                generatorId: generatorConfig.id,
                variant
              })

              this.#addPreview(
                source,
                generatorConfig.toPreviewModule?.({ context: this, operation, variant })
              )

              this.captureCurrentResult('success', st)
            } catch (error) {
              this.logger.error(error)

              this.captureCurrentResult('error', st)
            }
          })
        })
      })
    })
  }

  #runWebhookGenerator(
    oasDocument: OasDocument,
    generatorConfig: WebhookEntry,
    include: IncludePaths | undefined,
    skip: SkipPaths | undefined,
    stackTrail: StackTrail
  ) {
    oasDocument.webhooks.forEach(webhook => {
      stackTrail.trace(`webhook:${webhook.name}:${webhook.method}`, webhookTrail => {
        // Variant fan-out, keyed `[generatorId][name][method][variant]` —
        // the webhook analogue of the operation routing. `toVariantList`
        // handles absent / non-object / object enrichment blocks and
        // enforces the `'main'`-must-be-present rule.
        const webhookEnrichments: unknown = this.readEnrichment([
          generatorConfig.id,
          webhook.name,
          webhook.method
        ])

        const variants = toVariantList({
          opEnrichments: webhookEnrichments,
          generatorId: generatorConfig.id,
          operationLabel: `webhook '${webhook.name}' (${webhook.method.toUpperCase()})`
        })

        variants.forEach(variant => {
          webhookTrail.trace(`variant: ${variant}`, st => {
            try {
              if (
                typeof generatorConfig?.isSupported === 'function' &&
                !generatorConfig.isSupported({ webhook, context: this, variant })
              ) {
                this.captureCurrentResult('notSupported', st)
                return
              }

              // Order: isSupported (capability) → include (allow) → skip
              // (deny). The skip/include shape is structurally identical to
              // operations (the webhook name occupies the `path` slot), so
              // `matchesPathFilter` is reused with `path: webhook.name`.
              if (
                include !== undefined &&
                !matchesPathFilter({
                  paths: include,
                  path: webhook.name,
                  method: webhook.method,
                  variant
                })
              ) {
                this.#reportSkippedEnrichment(webhookEnrichments, variant, [
                  generatorConfig.id,
                  webhook.name,
                  webhook.method,
                  variant
                ])
                this.captureCurrentResult('skipped', st)
                return
              }

              if (
                matchesPathFilter({
                  paths: skip,
                  path: webhook.name,
                  method: webhook.method,
                  variant
                })
              ) {
                this.#reportSkippedEnrichment(webhookEnrichments, variant, [
                  generatorConfig.id,
                  webhook.name,
                  webhook.method,
                  variant
                ])
                this.captureCurrentResult('skipped', st)
                return
              }

              generatorConfig.transform({
                context: this,
                webhook,
                variant
              })

              const source = toWebhookSource({
                webhook,
                generatorId: generatorConfig.id,
                variant
              })

              this.#addPreview(
                source,
                generatorConfig.toPreviewModule?.({ context: this, webhook, variant })
              )

              this.captureCurrentResult('success', st)
            } catch (error) {
              this.logger.error(error)

              this.captureCurrentResult('error', st)
            }
          })
        })
      })
    })
  }

  #runGqlOperationGenerator(
    gqlDocument: GqlDocument,
    generatorConfig: GqlOperationEntry,
    stackTrail: StackTrail
  ) {
    gqlDocument.operations.forEach(operation => {
      stackTrail.trace(operation.identifier, opTrail => {
        // GraphQL enrichment routing key is
        // `[generatorId][rootKind][fieldName][variant]`.
        const opEnrichments: unknown = this.readEnrichment([
          generatorConfig.id,
          operation.rootKind,
          operation.fieldName
        ])

        const variants = toVariantList({
          opEnrichments,
          generatorId: generatorConfig.id,
          operationLabel: `${operation.rootKind} ${operation.fieldName}`
        })

        variants.forEach(variant => {
          opTrail.trace(`variant: ${variant}`, st => {
            try {
              if (
                typeof generatorConfig.isSupported === 'function' &&
                !generatorConfig.isSupported({ operation, context: this, variant })
              ) {
                this.captureCurrentResult('notSupported', st)
                return
              }

              generatorConfig.transform({
                context: this,
                operation,
                variant
              })

              const source = toGqlOperationSource({
                operation,
                generatorId: generatorConfig.id,
                variant
              })

              this.#addPreview(
                source,
                generatorConfig.toPreviewModule?.({ context: this, operation, variant })
              )

              this.captureCurrentResult('success', st)
            } catch (error) {
              this.logger.error(error)
              this.captureCurrentResult('error', st)
            }
          })
        })
      })
    })
  }

  #runModelGenerator(
    document: SkmtcParsedDocument,
    generatorConfig: ModelEntry,
    include: IncludeModelRefs | undefined,
    skip: SkipModelRefs | undefined,
    stackTrail: StackTrail
  ) {
    const refNames =
      document.type === 'oas'
        ? (document.value.components?.toSchemasRefNames() ?? [])
        : document.value.registry.toSchemasRefNames()

    refNames.forEach(refName => {
      stackTrail.trace(refName, refTrail => {
        // Resolve the variant list to fan out over. The consumer's
        // enrichments are keyed `[generatorId][refName][variant]`; the
        // block at `[refName]` is therefore a record of variant names.
        // Three cases handled in `toVariantList`:
        //
        //   - absent → run a single 'main' pass with no enrichment
        //   - present, non-object → treat as a single 'main' pass
        //     (the per-variant Valibot wrap will reject this shape
        //     at config-load time once it lands)
        //   - present, object → enumerate keys; 'main' must be among
        //     them or we throw (loud beats silent zero-output)
        const modelEnrichments: unknown = this.readEnrichment([generatorConfig.id, refName])

        const variants = toVariantList({
          opEnrichments: modelEnrichments,
          generatorId: generatorConfig.id,
          operationLabel: refName
        })

        variants.forEach(variant => {
          refTrail.trace(`variant: ${variant}`, st => {
            try {
              if (
                typeof generatorConfig.isSupported === 'function' &&
                !generatorConfig.isSupported({ refName, context: this, variant })
              ) {
                this.captureCurrentResult('notSupported', st)
                return
              }

              // Order: isSupported (capability) → include (allow) → skip
              // (deny). Match is on `(refName, variant)`. An empty variant
              // array on a refName means "every variant of this refName"; a
              // populated array names the variants the entry applies to.
              if (include !== undefined && !matchesRefFilter({ refs: include, refName, variant })) {
                this.#reportSkippedEnrichment(modelEnrichments, variant, [
                  generatorConfig.id,
                  refName,
                  variant
                ])
                this.captureCurrentResult('skipped', st)
                return
              }

              if (matchesRefFilter({ refs: skip, refName, variant })) {
                this.#reportSkippedEnrichment(modelEnrichments, variant, [
                  generatorConfig.id,
                  refName,
                  variant
                ])
                this.captureCurrentResult('skipped', st)
                return
              }

              generatorConfig.transform({
                context: this,
                refName,
                variant
              })

              const source = toModelSource({
                refName,
                generatorId: generatorConfig.id,
                variant
              })

              this.#addPreview(
                source,
                generatorConfig.toPreviewModule?.({ context: this, refName, variant })
              )

              this.captureCurrentResult('success', st)
            } catch (error) {
              this.logger.error(error)
              this.captureCurrentResult('error', st)
            }
          })
        })
      })
    })
  }

  #addPreview(
    source: OasOperationSource | WebhookSource | GqlOperationSource | ModelSource,
    module: PreviewModule | undefined
  ) {
    if (!module) {
      return
    }

    if (this.#previews[module.name]) {
      throw new Error(`Cannot override preview module "${module.name}"`)
    }

    this.#previews[module.name] = {
      // Preview export paths are hand-assembled in `toPreviewModule`
      // (generators call the static `toExportPath` directly), so they
      // bypass the ContentSettings construction path — run them through the same
      // suffix injection or previews point at files that don't exist.
      module: { ...module, exportPath: this.#toContentSettingsExportPath(module.exportPath) },
      source
    }
  }

  /**
   * The single point where a projection-declared export path becomes
   * an engine path — the value stored into `ContentSettings.exportPath`:
   *
   * 1. Injects the project's generated-file suffix
   *    (`client.json#settings.generatedSuffix`, default `'.generated'`)
   *    before the extension. Idempotent, so generators that still
   *    hardcode the suffix are unaffected.
   * 2. For an ejected file (`settings.ejected`), stores the ejected
   *    (suffix-less, user-owned) path instead — so cache keys, import
   *    specifiers, previews, sidecars, and the manifest all reference
   *    the file the user actually owns, with no changes anywhere else.
   *
   * Explicit `destinationPath` arguments elsewhere are deliberately
   * NOT run through this — `register`/`registerInto`/`registerJson`
   * name real files verbatim (a JSON config or a hand-named barrel
   * must not be renamed).
   */
  #toContentSettingsExportPath(exportPath: string): string {
    const suffixed = applyGeneratedSuffix(
      exportPath,
      this.settings?.generatedSuffix ?? DEFAULT_GENERATED_SUFFIX
    )

    return this.#ejectedBySuffixedPath.get(normalize(suffixed)) ?? suffixed
  }

  /**
   * Suffixed export path → ejected (owned) path, built once from
   * `settings.ejected`. Keyed by the suffixed form because that is
   * what suffix injection produces for the generator's declared path;
   * the values are the suffix-less paths the user owns.
   */
  get #ejectedBySuffixedPath(): Map<string, string> {
    if (this.#ejectedBySuffixedPathCache === undefined) {
      const suffix = this.settings?.generatedSuffix ?? DEFAULT_GENERATED_SUFFIX

      this.#ejectedBySuffixedPathCache = new Map(
        (this.settings?.ejected ?? []).map(ejectedPath => {
          const normalized = normalize(ejectedPath)
          return [normalize(applyGeneratedSuffix(normalized, suffix)), normalized]
        })
      )
    }

    return this.#ejectedBySuffixedPathCache
  }

  #ejectedBySuffixedPathCache: Map<string, string> | undefined

  /**
   * Look up an already-registered file by path, or `undefined` if none
   * exists. Neutral primitive: returns the abstract `FileBase` and never
   * constructs anything, so a (future) language-owned `register` can ask
   * "does this file exist yet?" without the engine knowing the language.
   * To create-on-miss, use the internal `#getFile`; to add a
   * language-constructed file, use {@link addFile}.
   */
  getFile(filePath: string): FileBase | undefined {
    return this.#files.get(normalize(filePath))
  }

  /**
   * Read-only view of every file generated so far, keyed by (normalized)
   * export path. An **inspection / tooling** seam — NOT a coordination
   * surface: generators must still register via `register` / `insert*`, and
   * the storage stays `#`-private so nothing outside can mutate or re-bind it.
   *
   * Unlike {@link getFile} (which needs a path) this lets tooling *enumerate*
   * the files map — e.g. a debugger visualiser snapshotting the in-progress
   * state at a breakpoint. The `ReadonlyMap` type signals look-don't-touch.
   */
  get inspectedFiles(): ReadonlyMap<string, FileBase> {
    return this.#files
  }

  /**
   * Store a language-constructed file. The engine never constructs a
   * concrete (language) `File`; the language's `register` builds its own
   * `FileBase` subclass and hands it in here. Throws if a file already
   * exists at the (normalized) path. Returns the stored file, so
   * get-or-create is a single expression at the call site
   * (`context.getFile(path) ?? context.addFile(new KtFile({ … }))`).
   */
  addFile<File extends FileBase>(file: File): File {
    const normalizedPath = normalize(file.path)

    if (this.#files.has(normalizedPath)) {
      throw new Error(`File already exists: ${normalizedPath}`)
    }

    this.#files.set(normalizedPath, file)

    return file
  }

  /**
   * Registers JSON content for output to a file.
   *
   * @experimental This method is experimental and may change in future versions
   * @param args - Registration arguments with destination path and JSON content
   */
  registerJson({ destinationPath, json }: RegisterJsonArgs) {
    const normalizedPath = normalize(destinationPath)

    let currentFile = this.getFile(normalizedPath)

    if (!currentFile) {
      currentFile = new JsonFile({ path: normalizedPath, content: {} })
      this.addFile(currentFile)
    }

    invariant(
      currentFile instanceof JsonFile,
      `File at "${destinationPath}" is not a "JsonFile" type`
    )

    currentFile.content = json
  }

  /**
   * Registers Markdown content for output to a file.
   *
   * The Markdown counterpart of {@link registerJson} — create-or-replace, last
   * write wins. The `markdown` is any {@link Stringable} (typically a composed
   * snippet tree), rendered verbatim into a {@link MarkdownFile}.
   *
   * @experimental This method is experimental and may change in future versions
   */
  registerMarkdown({ destinationPath, markdown }: RegisterMarkdownArgs) {
    const normalizedPath = normalize(destinationPath)

    let currentFile = this.getFile(normalizedPath)

    if (!currentFile) {
      currentFile = new MarkdownFile({ path: normalizedPath, content: '' })
      this.addFile(currentFile)
    }

    invariant(
      currentFile instanceof MarkdownFile,
      `File at "${destinationPath}" is not a "MarkdownFile" type`
    )

    currentFile.content = markdown
  }

  /**
   * Insert supplied `imports` and `definitions` into file at `destinationPath`.
   *
   * If an import from a specified module already exists in the file, the
   * import names are appended to the existing import.
   *
   * Definitions will only be added if there is not already a definition with
   * the same name in the file.
   *
   * @mutates this.files
   */
  register({
    imports = [],
    reExports = [],
    definitions,
    custom,
    destinationPath
  }: ContextRegisterArgs) {
    const normalizedPath = normalize(destinationPath)

    const currentFile = this.getFile(normalizedPath)

    // `register` never creates files — it speaks pure data and the engine
    // never names a file class. Callers pre-create the destination file
    // through their language (the lang package's register function, the
    // Drivers' ensureFile); reaching a file-miss here is a bug at the
    // caller.
    invariant(
      currentFile,
      `Cannot register into '${normalizedPath}' — the file does not exist. ` +
        `Pre-create it through your lang (its register function does this).`
    )

    // `custom` is language-neutral — it lives on `FileBase`, so any file
    // (code or not, e.g. a JSON/Markdown file) can receive it. Last
    // non-`undefined` write wins.
    if (custom !== undefined) {
      currentFile.custom = custom
    }

    // Definitions, imports, and re-exports — and their duplication/merge
    // policy — are code-file concerns owned by the language subclass.
    // `JsonFile` (no definitions/imports) is skipped by the guard.
    if (currentFile instanceof CodeFileBase) {
      definitions?.forEach(definition => {
        if (definition) {
          currentFile.addDefinition(definition)
        }
      })

      if (imports.length > 0) {
        currentFile.addImports(imports)
      }

      if (reExports.length > 0) {
        currentFile.addReExports(reExports)
      }
    }
  }

  /**
   * Insert operation into the output file with path `destinationPath`.
   *
   * Insert will perform the following steps:
   * Insert an operation definition into `destinationPath`.
   *
   * Resolves identifier and export path from the projection, registers the
   * definition (or reuses a cached one), and stitches an import into
   * `destinationPath` if it differs from the projection's `exportPath`.
   *
   * @mutates this.files
   */
  insertOperation<V extends GeneratedValue, EnrichmentType = undefined>(
    args: InsertOperationArgs<V, EnrichmentType>
  ): Inserted<V, EnrichmentType> {
    // Default to the canonical variant. Callers who explicitly thread
    // a variant (e.g. variants-aware Projections threading
    // `this.settings.variant`) override this default.
    const variant = args.variant ?? DEFAULT_VARIANT

    if (isGqlInsertOperationArgs(args)) {
      const { settings, definition } = new GqlOperationDriver({
        context: this,
        projection: args.projection,
        operation: args.operation,
        destinationPath: args.destinationPath,
        noExport: args.noExport ?? false,
        variant
      })

      return new Inserted({ settings, definition })
    }

    const { settings, definition } = new OasOperationDriver({
      context: this,
      projection: args.projection,
      operation: args.operation,
      destinationPath: args.destinationPath,
      noExport: args.noExport ?? false,
      variant
    })

    return new Inserted({ settings, definition })
  }

  /**
   * Insert a webhook's projection. Sibling of {@link insertOperation} for
   * the OAS 3.1 webhook subject — webhooks are OAS-only, so there is no
   * protocol discrimination.
   */
  insertWebhook<V extends GeneratedValue, EnrichmentType = undefined>(
    args: InsertWebhookArgs<V, EnrichmentType>
  ): Inserted<V, EnrichmentType> {
    const variant = args.variant ?? DEFAULT_VARIANT

    const { settings, definition } = new WebhookDriver({
      context: this,
      projection: args.projection,
      webhook: args.webhook,
      destinationPath: args.destinationPath,
      noExport: args.noExport ?? false,
      variant
    })

    return new Inserted({ settings, definition })
  }

  /**
   * Insert a normalized model: dispatch to {@link insertModel} when the schema
   * is a `$ref`, otherwise produce a one-off definition under `fallbackName`.
   */
  insertNormalizedModel<
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType
  >(
    projection: NormalizedModelProjection<V, EnrichmentType>,
    { schema, fallbackName, destinationPath }: InsertNormalizedModelArgs<Schema>,
    { noExport = false, variant }: InsertNormalizedModelOptions = {}
  ): InsertNormalizedModelReturn<V, Schema> {
    if (schema.isRef()) {
      const { definition } = this.insertModel(projection, schema.toRefName(), {
        destinationPath,
        noExport,
        variant
      })

      // @TODO Using mapped types would help avoid generics casting
      return definition as InsertNormalizedModelReturn<V, Schema>
    }

    const cachedDefinition = this.findDefinition({
      name: fallbackName,
      exportPath: destinationPath
    })

    // @TODO add check to make sure retrieved definition
    // used same generator and same schema #SKM-47
    if (cachedDefinition) {
      return cachedDefinition as InsertNormalizedModelReturn<V, Schema>
    }

    const value = projection.schemaToValueFn({
      context: this,
      schema,
      destinationPath,
      required: true
    })

    // The inline-schema fallback builds the Definition through the
    // projection's language — the static read off the projection class at
    // the use site (same ephemeral read the Drivers make) — pre-creates
    // the destination file caller-side, and stores via the pure-data
    // `register`.
    const normalizedPath = normalize(destinationPath)

    if (!this.getFile(normalizedPath)) {
      this.addFile(projection.lang.createFile({ path: normalizedPath, settings: this.settings }))
    }

    const definition = projection.lang.toDefinition({
      context: this,
      identifier: projection.createIdentifier(fallbackName),
      value,
      noExport
    })

    this.register({ definitions: [definition], destinationPath: normalizedPath })

    // @TODO Using mapped types would help avoid generics casting
    return definition as InsertNormalizedModelReturn<V, Schema>
  }

  /**
   * Insert a model definition into `destinationPath`.
   *
   * Resolves identifier and export path from the projection, registers the
   * definition (or reuses a cached one), and stitches an import into
   * `destinationPath` if it differs from the projection's `exportPath`.
   *
   * @mutates this.files
   */
  insertModel<V extends GeneratedValue, EnrichmentType>(
    projection: ModelProjection<V, EnrichmentType>,
    refName: RefName,
    { destinationPath, noExport = false, variant }: InsertModelOptions = {}
  ): Inserted<V, EnrichmentType> {
    // Default to the canonical variant. Callers who explicitly thread
    // a variant (e.g. variants-aware Projections threading
    // `this.settings.variant`) override this default.
    const resolvedVariant = variant ?? DEFAULT_VARIANT

    const { settings, definition } = new ModelDriver({
      context: this,
      projection,
      refName,
      destinationPath,
      rootRef: refName,
      noExport,
      variant: resolvedVariant
    })

    return new Inserted({ settings, definition })
  }

  /**
   * Build content settings for an operation projection by calling its
   * statics `toIdentifierName` + `toIdentifierType`, `toExportPath`, and
   * `toEnrichments` against the
   * given operation.
   */
  toOperationContentSettings<V extends GeneratedValue, EnrichmentType>(
    args: ToOperationSettingsArgs<V, EnrichmentType>
  ): ContentSettings<EnrichmentType> {
    const variant = args.variant ?? DEFAULT_VARIANT

    if (isGqlToOperationSettingsArgs(args)) {
      const enrichments = args.projection.toEnrichments({
        operation: args.operation,
        context: this,
        variant
      })
      return new ContentSettings<EnrichmentType>({
        identifier: args.projection.lang.toIdentifier({
          name: args.projection.toIdentifierName({
            operation: args.operation,
            enrichments,
            variant
          }),
          ...args.projection.toIdentifierType(args.operation, this)
        }),
        exportPath: this.#toContentSettingsExportPath(
          args.projection.toExportPath({
            operation: args.operation,
            enrichments,
            variant
          })
        ),
        enrichments,
        variant
      })
    }

    const enrichments = args.projection.toEnrichments({
      operation: args.operation,
      context: this,
      variant
    })
    return new ContentSettings<EnrichmentType>({
      identifier: args.projection.lang.toIdentifier({
        name: args.projection.toIdentifierName({
          operation: args.operation,
          enrichments,
          variant
        }),
        ...args.projection.toIdentifierType(args.operation, this)
      }),
      exportPath: this.#toContentSettingsExportPath(
        args.projection.toExportPath({
          operation: args.operation,
          enrichments,
          variant
        })
      ),
      enrichments,
      variant
    })
  }

  /**
   * Build content settings for a webhook projection. Sibling of
   * {@link toOperationContentSettings}; webhooks are OAS-only, so there is no
   * protocol discrimination.
   */
  toWebhookContentSettings<V extends GeneratedValue, EnrichmentType>(
    args: ToWebhookSettingsArgs<V, EnrichmentType>
  ): ContentSettings<EnrichmentType> {
    const variant = args.variant ?? DEFAULT_VARIANT

    const enrichments = args.projection.toEnrichments({
      webhook: args.webhook,
      context: this,
      variant
    })
    return new ContentSettings<EnrichmentType>({
      identifier: args.projection.lang.toIdentifier({
        name: args.projection.toIdentifierName({
          webhook: args.webhook,
          enrichments,
          variant
        }),
        ...args.projection.toIdentifierType(args.webhook, this)
      }),
      exportPath: this.#toContentSettingsExportPath(
        args.projection.toExportPath({
          webhook: args.webhook,
          enrichments,
          variant
        })
      ),
      enrichments,
      variant
    })
  }

  /**
   * Build content settings for a model projection by calling its statics
   * `toIdentifierName` (pure, for the name) + `toIdentifierType`
   * (context-aware, for type/typeName/exported), `toExportPath`, and
   * `toEnrichments` against the given `refName` and `variant`. The full
   * identifier is assembled through the projection's language
   * (`lang.toIdentifier`).
   */
  toModelContentSettings<V extends GeneratedValue, EnrichmentType>({
    refName,
    projection,
    variant = DEFAULT_VARIANT
  }: BuildModelSettingsArgs<V, EnrichmentType>): ContentSettings<EnrichmentType> {
    const enrichments = projection.toEnrichments({ refName, context: this, variant })
    return new ContentSettings<EnrichmentType>({
      identifier: projection.lang.toIdentifier({
        name: projection.toIdentifierName({ refName, enrichments, variant }),
        ...projection.toIdentifierType(refName, this)
      }),
      exportPath: this.#toContentSettingsExportPath(
        projection.toExportPath({ refName, enrichments, variant })
      ),
      enrichments,
      variant
    })
  }

  /**
   * Perform one lookup of schema by `refName`.
   * @param refName
   * @returns Matching schema or ref
   * @throws if schema is not found
   */
  resolveSchemaRefOnce(refName: RefName, generatorId: string): OasSchema | OasRef<'schema'> {
    this.modelDepth[`${generatorId}:${refName}`]++

    const schema =
      this.document.type === 'oas'
        ? this.document.value.components?.schemas?.[refName]?.resolveOnce()
        : this.document.value.registry.schemas[refName]

    if (!schema) {
      throw new Error(`Schema not found: ${refName}`)
    }

    // GqlRegistry stores raw OasSchema | OasRef entries that we need to
    // resolve once for parity with the OAS code path.
    if (this.document.type === 'gql' && 'resolveOnce' in schema) {
      return (schema as OasRef<'schema'>).resolveOnce()
    }

    return schema
  }

  /**
   * Check if definition name `name` in file with path `exportPath`
   * has already been created and registered.
   *
   * @param { name, exportPath }
   * @returns Matching definition if found or `undefined` otherwise
   */
  findDefinition({ name, exportPath }: PickArgs): DefinitionBase | undefined {
    // Pure lookup — no file is created on a miss. Definitions live on the
    // code-file subclass, so narrow; a non-code file (`JsonFile`) has none.
    // The cache wants the single primary for the name → first match.
    const file = this.getFile(exportPath)
    return file instanceof CodeFileBase ? file.findDefinitions({ name })?.[0] : undefined
  }
}

type MatchesPathFilterArgs = {
  paths: SkipPaths | IncludePaths | undefined
  path: string
  method: Method
  variant: string
}

/**
 * Match a `(path, method, variant)` tuple against an operation-shaped
 * skip or include entry. Shared by both arms because skip and include
 * have the same matching rules; only the engine's interpretation of
 * the result differs (skip = deny, include = allow).
 *
 * Returns `false` when:
 * - `paths` is `undefined` (no filter applies)
 * - the `path` isn't keyed in the entry
 * - the `method` isn't present in the inner record
 *
 * Returns `true` when:
 * - the method's variant array is empty (matches every variant)
 * - the method's variant array contains `variant`
 */
const matchesPathFilter = ({ paths, path, method, variant }: MatchesPathFilterArgs): boolean => {
  if (!paths) {
    return false
  }

  const methodMap = paths[path]
  if (!methodMap) {
    return false
  }

  const variants = methodMap[method]
  if (variants === undefined) {
    return false
  }

  if (variants.length === 0) {
    return true
  }

  return variants.includes(variant)
}

type MatchesRefFilterArgs = {
  refs: SkipModelRefs | IncludeModelRefs | undefined
  refName: string
  variant: string
}

/**
 * Match a `(refName, variant)` tuple against a model-shaped skip or
 * include entry. Sibling to {@link matchesPathFilter} — both arms
 * share matching rules; only the engine's interpretation of the
 * result differs (skip = deny, include = allow).
 *
 * Returns `false` when:
 * - `refs` is `undefined` (no filter applies)
 * - the `refName` isn't keyed in the entry
 *
 * Returns `true` when:
 * - the refName's variant array is empty (matches every variant)
 * - the refName's variant array contains `variant`
 */
const matchesRefFilter = ({ refs, refName, variant }: MatchesRefFilterArgs): boolean => {
  if (!refs) {
    return false
  }

  const variants = refs[refName]
  if (variants === undefined) {
    return false
  }

  if (variants.length === 0) {
    return true
  }

  return variants.includes(variant)
}

type ToOasOperationSourceArgs = {
  operation: OasOperation
  generatorId: string
  /** Operation variant the artifact was emitted for (see {@link Variant}) */
  variant: string
}

/**
 * Creates an OasOperationSource from an operation, generator ID, and variant.
 *
 * Transforms operation and generator information into a source descriptor
 * that can be used for tracking operation origins in the generation pipeline.
 *
 * @param args - Arguments containing operation, generator ID, and variant
 * @returns OasOperationSource descriptor for the operation
 */
export const toOasOperationSource = ({
  operation,
  generatorId,
  variant
}: ToOasOperationSourceArgs): OasOperationSource => ({
  type: 'oasOperation',
  generatorId,
  operationPath: operation.path,
  operationMethod: operation.method,
  variant
})

type ToWebhookSourceArgs = {
  webhook: OasWebhook
  generatorId: string
  /** Webhook variant the artifact was emitted for (see {@link Variant}) */
  variant: string
}

/**
 * Creates a {@link WebhookSource} from a webhook, generator ID, and variant.
 * Sibling of {@link toOasOperationSource} for the 3.1 webhook subject.
 */
export const toWebhookSource = ({
  webhook,
  generatorId,
  variant
}: ToWebhookSourceArgs): WebhookSource => ({
  type: 'webhook',
  generatorId,
  webhookName: webhook.name,
  webhookMethod: webhook.method,
  variant
})

type ToGqlOperationSourceArgs = {
  operation: GqlOperation
  generatorId: string
  /** Operation variant the artifact was emitted for (see {@link Variant}) */
  variant: string
}

/**
 * Creates a GraphQL operation source descriptor.
 *
 * Sibling to {@link toOasOperationSource} for the GraphQL protocol — encodes
 * `rootKind` and `fieldName` instead of `path` / `method`.
 */
export const toGqlOperationSource = ({
  operation,
  generatorId,
  variant
}: ToGqlOperationSourceArgs): GqlOperationSource => ({
  type: 'gqlOperation',
  generatorId,
  rootKind: operation.rootKind,
  fieldName: operation.fieldName,
  variant
})

type ToModelSourceArgs = {
  refName: RefName
  generatorId: string
  /** Model variant the artifact was emitted for (see {@link Variant}) */
  variant: string
}

/**
 * Creates a ModelSource from a reference name, generator ID, and variant.
 *
 * Transforms model reference and generator information into a source descriptor
 * that can be used for tracking model origins in the generation pipeline.
 *
 * @param args - Arguments containing reference name, generator ID, and variant
 * @returns ModelSource descriptor for the model
 */
export const toModelSource = ({
  refName,
  generatorId,
  variant
}: ToModelSourceArgs): ModelSource => ({
  type: 'model',
  generatorId,
  refName,
  variant
})

const toSkipPaths = (
  skip: SkipOperations | SkipModels | undefined,
  generatorId: string
): SkipPaths | undefined => {
  const generatorSkip = skip?.[generatorId]

  // Operation-shaped entries have records-of-records at the inner
  // slot (`Record<path, Record<method, variant[]>>`); model-shaped
  // entries have records-of-arrays (`Record<refName, variant[]>`).
  // Discriminate by inner value shape. An empty record is ambiguous
  // and admitted by both helpers — each arm will see its own empty
  // filter (`{}`), which means "match nothing" in both cases.
  if (
    typeof generatorSkip === 'object' &&
    generatorSkip !== null &&
    !Array.isArray(generatorSkip)
  ) {
    const values = Object.values(generatorSkip)
    if (
      values.length === 0 ||
      values.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))
    ) {
      return generatorSkip as SkipPaths
    }
  }

  return undefined
}

const toSkipModels = (
  skip: SkipOperations | SkipModels | undefined,
  generatorId: string
): SkipModelRefs | undefined => {
  const generatorSkip = skip?.[generatorId]

  // SkipModelRefs is `Record<refName, variant[]>`. The operation arm
  // entries are `Record<path, Record<method, variant[]>>` — discriminate
  // by inner value shape (arrays vs nested records). An empty record is
  // ambiguous and admitted by both helpers — see `toSkipPaths`.
  if (
    typeof generatorSkip === 'object' &&
    generatorSkip !== null &&
    !Array.isArray(generatorSkip)
  ) {
    const values = Object.values(generatorSkip)
    if (values.length === 0 || values.every(v => Array.isArray(v))) {
      return generatorSkip as SkipModelRefs
    }
  }

  return undefined
}

/**
 * Extracts the per-operation include slice for a generator, mirroring
 * {@link toSkipPaths}. Returns `undefined` when the include entry
 * isn't operation-shaped for this generator (e.g. the user passed a
 * model-shaped array or no entry at all) — the caller then treats
 * "no per-op filter active" as the semantics.
 */
const toIncludePaths = (
  include: IncludeOperations | IncludeModels | undefined,
  generatorId: string
): IncludePaths | undefined => {
  const generatorInclude = include?.[generatorId]

  // Same model/operation discrimination as `toSkipPaths`.
  if (
    typeof generatorInclude === 'object' &&
    generatorInclude !== null &&
    !Array.isArray(generatorInclude)
  ) {
    const values = Object.values(generatorInclude)
    if (
      values.length === 0 ||
      values.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))
    ) {
      return generatorInclude as IncludePaths
    }
  }

  return undefined
}

/**
 * Extracts the per-model include slice for a generator, mirroring
 * {@link toSkipModels}. Returns `undefined` when the include entry
 * isn't model-shaped for this generator.
 */
const toIncludeModels = (
  include: IncludeOperations | IncludeModels | undefined,
  generatorId: string
): IncludeModelRefs | undefined => {
  const generatorInclude = include?.[generatorId]

  if (
    typeof generatorInclude === 'object' &&
    generatorInclude !== null &&
    !Array.isArray(generatorInclude)
  ) {
    const values = Object.values(generatorInclude)
    if (values.length === 0 || values.every(v => Array.isArray(v))) {
      return generatorInclude as IncludeModelRefs
    }
  }

  return undefined
}
