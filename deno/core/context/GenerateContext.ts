import { normalize } from '@std/path/normalize'
import { Import } from '@/dsl/Import.ts'
import { Definition } from '@/dsl/Definition.ts'
import type { OasDocument } from '@/oas/document/Document.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import type { SkmtcParsedDocument } from '@/types/SkmtcDocument.ts'
import type {
  BuildModelSettingsArgs,
  DefineAndRegisterArgs,
  GenerateContextType,
  GenerateResult,
  GetFileOptions,
  InsertGqlOperationArgs,
  InsertModelOptions,
  InsertNormalizedModelArgs,
  InsertNormalizedModelOptions,
  InsertNormalizedModelReturn,
  InsertOperationArgs,
  PickArgs,
  RegisterArgs,
  RegisterJsonArgs,
  ToGqlOperationSettingsArgs,
  ToOperationSettingsArgs
} from './generateTypes.ts'
import type {
  ClientSettings,
  IncludeModels,
  IncludeOperations,
  IncludePaths,
  SkipModels,
  SkipOperations,
  SkipPaths
} from '@/types/Settings.ts'
import type { Method } from '@/types/Method.ts'
import type { OasOperationConfig } from '@/dsl/operation/oas/types.ts'
import type { GqlOperationConfig } from '@/dsl/operation/gql/types.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ModelConfig, ModelProjection } from '@/dsl/model/types.ts'
import { OasOperationDriver } from '@/dsl/operation/oas/OasOperationDriver.ts'
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
import type { Identifier } from '@/dsl/Identifier.ts'
import type { SchemaToValueFn, SchemaType } from '@/types/TypeSystem.ts'
import { Inserted } from '@/dsl/Inserted.ts'
import { File } from '@/dsl/File.ts'
import { JsonFile } from '@/dsl/JsonFile.ts'
import invariant from 'tiny-invariant'
import type { GeneratorConfig, GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type {
  OasOperationSource,
  GqlOperationSource,
  ModelSource,
  Preview,
  PreviewModule,
  MappingModule,
  Mapping
} from '@/types/Preview.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { OasVoid } from '@/oas/void/Void.ts'

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
  identifier: Identifier
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
 *       identifier: Identifier.createType(this.refName),
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

const isGqlToOperationSettingsArgs = <V, EnrichmentType>(
  args: ToOperationSettingsArgs<V, EnrichmentType>
): args is ToGqlOperationSettingsArgs<V, EnrichmentType> =>
  args.operation.oasType === 'gqlOperation'

export class GenerateContext implements GenerateContextType {
  #files: Map<string, File | JsonFile>
  #previews: Record<string, Preview>
  #mappings: Record<string, Mapping>
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
  constructor({
    document,
    settings,
    logger,
    captureCurrentResult,
    toGeneratorConfigMap
  }: ConstructorArgs) {
    this.logger = logger
    this.#files = new Map()
    this.#previews = {}
    this.#mappings = {}
    this.document = document
    this.settings = settings
    this.captureCurrentResult = captureCurrentResult
    this.toGeneratorConfigMap = toGeneratorConfigMap
    this.modelDepth = {}
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

        // Whole-generator include gate (allow-list). When `include` is
        // set and the generator isn't mentioned by id — neither as a
        // string entry nor as a key in any object entry — the whole
        // generator is silently excluded. Parity with whole-generator
        // skip: no per-operation `skipped` entries flood the manifest
        // for a generator the user explicitly opted out of via omission.
        //
        // An empty `include` array (`[]`) is treated as "no filter
        // active" — the forgiving default — so old/blank configs
        // continue to behave unchanged.
        if (this.settings?.include !== undefined && this.settings.include.length > 0) {
          const isMentioned = this.settings.include.some(entry => {
            if (typeof entry === 'string') return entry === generatorConfig.id
            return typeof entry === 'object' && entry[generatorConfig.id] !== undefined
          })
          if (!isMentioned) {
            return
          }
        }

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
        const include: IncludeOperations | IncludeModels | undefined =
          this.settings?.include?.find(
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

    return {
      files: this.#files,
      previews: this.#previews,
      mappings: this.#mappings
    }
  }
  #runOasOperationGenerator(
    oasDocument: OasDocument,
    generatorConfig: OasOperationConfig,
    include: IncludePaths | undefined,
    skip: SkipPaths | undefined,
    stackTrail: StackTrail
  ) {
    oasDocument.operations.reduce<unknown>((acc, operation) => {
      return stackTrail.trace(`${operation.path}:${operation.method}`, opTrail => {
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
        const opEnrichments: unknown = get(
          this.settings,
          `enrichments.${generatorConfig.id}.${operation.path}.${operation.method}`
        )

        const variants = toVariantList({
          opEnrichments,
          generatorId: generatorConfig.id,
          operationLabel: `${operation.method.toUpperCase()} ${operation.path}`
        })

        return variants.reduce<unknown>((variantAcc, variant) => {
          return opTrail.trace(`variant: ${variant}`, st => {
            try {
              if (
                typeof generatorConfig?.isSupported === 'function' &&
                !generatorConfig.isSupported({ operation, context: this, variant })
              ) {
                this.captureCurrentResult('notSupported', st)
                return variantAcc
              }

              // Order: isSupported (capability) → include (allow) → skip
              // (deny). Match is now on `(path, method, variant)`. An
              // empty variant array on a method means "every variant of
              // this method"; a populated array names the variants the
              // entry applies to.
              if (
                include !== undefined &&
                !matchesPathFilter({ paths: include, path: operation.path, method: operation.method, variant })
              ) {
                this.captureCurrentResult('skipped', st)
                return variantAcc
              }

              if (matchesPathFilter({ paths: skip, path: operation.path, method: operation.method, variant })) {
                this.captureCurrentResult('skipped', st)
                return variantAcc
              }

              const result = generatorConfig.transform({
                context: this,
                operation,
                acc: variantAcc,
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

              this.#addMapping(
                source,
                generatorConfig.toMappingModule?.({ context: this, operation, variant })
              )

              this.captureCurrentResult('success', st)

              return result
            } catch (error) {
              this.logger.error(error)

              this.captureCurrentResult('error', st)
              return variantAcc
            }
          })
        }, acc)
      })
    }, undefined)
  }

  #runGqlOperationGenerator(
    gqlDocument: GqlDocument,
    generatorConfig: GqlOperationConfig,
    stackTrail: StackTrail
  ) {
    gqlDocument.operations.reduce<unknown>((acc, operation) => {
      return stackTrail.trace(operation.identifier, opTrail => {
        // GraphQL enrichment routing key is
        // `[generatorId][rootKind][fieldName][variant]`.
        const opEnrichments: unknown = get(
          this.settings,
          `enrichments.${generatorConfig.id}.${operation.rootKind}.${operation.fieldName}`
        )

        const variants = toVariantList({
          opEnrichments,
          generatorId: generatorConfig.id,
          operationLabel: `${operation.rootKind} ${operation.fieldName}`
        })

        return variants.reduce<unknown>((variantAcc, variant) => {
          return opTrail.trace(`variant: ${variant}`, st => {
            try {
              if (
                typeof generatorConfig.isSupported === 'function' &&
                !generatorConfig.isSupported({ operation, context: this, variant })
              ) {
                this.captureCurrentResult('notSupported', st)
                return variantAcc
              }

              const result = generatorConfig.transform({
                context: this,
                operation,
                acc: variantAcc,
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

              this.#addMapping(
                source,
                generatorConfig.toMappingModule?.({ context: this, operation, variant })
              )

              this.captureCurrentResult('success', st)
              return result
            } catch (error) {
              this.logger.error(error)
              this.captureCurrentResult('error', st)
              return variantAcc
            }
          })
        }, acc)
      })
    }, undefined)
  }

  #runModelGenerator(
    document: SkmtcParsedDocument,
    generatorConfig: ModelConfig,
    include: string[] | undefined,
    skip: string[] | undefined,
    stackTrail: StackTrail
  ) {
    const refNames =
      document.type === 'oas'
        ? (document.value.components?.toSchemasRefNames() ?? [])
        : document.value.registry.toSchemasRefNames()

    return refNames.reduce((acc, refName) => {
      return stackTrail.trace(refName, st => {
        try {
          // Same precedence as the OAS-operation arm: include (allow)
          // before skip (deny). `include === undefined` means no
          // per-model filter is active; an explicit empty list `[]`
          // means "include nothing" and everything emits `skipped`.
          if (include !== undefined && !include.includes(refName)) {
            this.captureCurrentResult('skipped', st)
            return acc
          }

          if (skip?.includes(refName)) {
            this.captureCurrentResult('skipped', st)
            return acc
          }

          const result = generatorConfig.transform({ context: this, refName, acc })

          const source = toModelSource({ refName, generatorId: generatorConfig.id })

          this.#addPreview(source, generatorConfig.toPreviewModule?.({ context: this, refName }))

          this.#addMapping(source, generatorConfig.toMappingModule?.({ context: this, refName }))

          this.captureCurrentResult('success', st)

          return result
        } catch (error) {
          this.logger.error(error)
          this.captureCurrentResult('error', st)
        }
      })
    }, undefined)
  }

  #addPreview(
    source: OasOperationSource | GqlOperationSource | ModelSource,
    module: PreviewModule | undefined
  ) {
    if (!module) {
      return
    }

    if (this.#previews[module.name]) {
      throw new Error(`Cannot override preview module "${module.name}"`)
    }

    this.#previews[module.name] = {
      module,
      source
    }
  }

  #addMapping(
    source: OasOperationSource | GqlOperationSource | ModelSource,
    module: MappingModule | undefined
  ) {
    if (!module) {
      return
    }

    if (this.#mappings[module.name]) {
      throw new Error(`Cannot override mapping module "${module.name}"`)
    }

    this.#mappings[module.name] = {
      module,
      source
    }
  }

  #getFile(filePath: string, { throwIfNotFound = false }: GetFileOptions = {}): File | JsonFile {
    const normalizedPath = normalize(filePath)

    const currentFile = this.#files.get(normalizedPath)

    if (!currentFile) {
      if (throwIfNotFound) {
        throw new Error(`File not found: '${normalizedPath}'`)
      } else {
        return this.#addFile(normalizedPath)
      }
    }

    return currentFile
  }

  /**
   * Create and register a definition with the given `identifier` at `destinationPath`.
   *
   * @experimental
   */
  defineAndRegister<V extends GeneratedValue>({
    identifier,
    value,
    destinationPath,
    noExport
  }: DefineAndRegisterArgs<V>): Definition<V> {
    // @TODO cache check is duplicatd if call comes from
    // createAndRegisterDefinition. Look for a way to share code between
    // these two functions
    const cachedDefinition = this.findDefinition({
      name: identifier.name,
      exportPath: destinationPath
    })

    // @TODO add check to make sure retrieved definition
    // used same generator and same schema #SKM-47
    if (cachedDefinition) {
      return cachedDefinition as Definition<V>
    }

    return this.#defineAndRegister({
      identifier,
      value,
      destinationPath,
      noExport
    })
  }

  /**
   * Create and register a definition with the given `identifier` at `destinationPath` without duplication checks.
   *
   * @experimental
   */
  #defineAndRegister<V extends GeneratedValue>({
    identifier,
    value,
    destinationPath,
    noExport
  }: DefineAndRegisterArgs<V>): Definition<V> {
    const definition = new Definition({
      context: this,
      identifier,
      value,
      noExport
    })

    this.register({
      definitions: [definition],
      destinationPath
    })

    return definition
  }

  /**
   * Registers JSON content for output to a file.
   *
   * @experimental This method is experimental and may change in future versions
   * @param args - Registration arguments with destination path and JSON content
   */
  registerJson({ destinationPath, json }: RegisterJsonArgs) {
    const currentFile = this.#getFile(destinationPath)

    invariant(
      currentFile instanceof JsonFile,
      `File at "${destinationPath}" is not a "JsonFile" type`
    )

    currentFile.content = json
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
  register({ imports = {}, definitions, destinationPath, reExports }: RegisterArgs) {
    // TODO deduplicate import names and definition names against each other
    const currentFile = this.#getFile(destinationPath)

    invariant(currentFile instanceof File, `File at "${destinationPath}" is not a "File" type`)

    Object.entries(reExports ?? {}).forEach(([importModule, identifiers]) => {
      if (!currentFile.reExports.get(importModule) && identifiers.length) {
        currentFile.reExports.set(importModule, {})
      }

      identifiers.forEach(identifier => {
        const entityType = identifier.entityType.type

        const module = currentFile.reExports.get(importModule)

        invariant(module, 'Module not found')

        if (!module[entityType]) {
          module[entityType] = new Set()
        }

        module[entityType].add(identifier.name)
      })
    })

    Object.entries(imports).forEach(([importModule, importNames]) => {
      const module = currentFile.imports.get(importModule)

      const importItem = new Import({ module: importModule, importNames })

      if (module) {
        importItem.importNames.forEach(n => module.add(`${n}`))
      } else {
        currentFile.imports.set(importModule, new Set(importItem.importNames.map(n => `${n}`)))
      }
    })

    definitions?.forEach(definition => {
      if (!definition) {
        return
      }

      const { name } = definition.identifier

      if (!currentFile.definitions.has(name)) {
        currentFile.definitions.set(name, definition)
      }
    })
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
   * Insert a normalized model: dispatch to {@link insertModel} when the schema
   * is a `$ref`, otherwise produce a one-off definition under `fallbackName`.
   */
  insertNormalizedModel<
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType
  >(
    projection: ModelProjection<V, EnrichmentType>,
    { schema, fallbackName, destinationPath }: InsertNormalizedModelArgs<Schema>,
    { noExport = false }: InsertNormalizedModelOptions = {}
  ): InsertNormalizedModelReturn<V, Schema> {
    if (schema.isRef()) {
      const { definition } = this.insertModel(projection, schema.toRefName(), {
        destinationPath,
        noExport
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

    const definition = this.#defineAndRegister({
      identifier: projection.createIdentifier(fallbackName),
      value,
      destinationPath,
      noExport
    })

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
    { destinationPath, noExport = false }: InsertModelOptions = {}
  ): Inserted<V, EnrichmentType> {
    const { settings, definition } = new ModelDriver({
      context: this,
      projection,
      refName,
      destinationPath,
      rootRef: refName,
      noExport
    })

    return new Inserted({ settings, definition })
  }

  /**
   * Build content settings for an operation projection by calling its
   * static `toIdentifier`, `toExportPath`, and `toEnrichments` against the
   * given operation.
   */
  toOperationContentSettings<V, EnrichmentType>(
    args: ToOperationSettingsArgs<V, EnrichmentType>
  ): ContentSettings<EnrichmentType> {
    const { variant } = args

    if (isGqlToOperationSettingsArgs(args)) {
      const enrichments = args.projection.toEnrichments({
        operation: args.operation,
        context: this,
        variant
      })
      return new ContentSettings<EnrichmentType>({
        identifier: args.projection.toIdentifier({
          operation: args.operation,
          enrichments,
          variant
        }),
        exportPath: args.projection.toExportPath({
          operation: args.operation,
          enrichments,
          variant
        }),
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
      identifier: args.projection.toIdentifier({
        operation: args.operation,
        enrichments,
        variant
      }),
      exportPath: args.projection.toExportPath({
        operation: args.operation,
        enrichments,
        variant
      }),
      enrichments,
      variant
    })
  }

  /**
   * Build content settings for a model projection by calling its static
   * `toIdentifier`, `toExportPath`, and `toEnrichments` against the given
   * `refName`.
   */
  toModelContentSettings<V, EnrichmentType>({
    refName,
    projection
  }: BuildModelSettingsArgs<V, EnrichmentType>): ContentSettings<EnrichmentType> {
    // Models don't participate in the operation-variant axis — every
    // model Definition carries the canonical default variant name.
    const enrichments = projection.toEnrichments({ refName, context: this })
    return new ContentSettings<EnrichmentType>({
      identifier: projection.toIdentifier({ refName, enrichments }),
      exportPath: projection.toExportPath({ refName, enrichments }),
      enrichments,
      variant: DEFAULT_VARIANT
    })
  }

  #addFile(normalizedPath: string): File | JsonFile {
    if (this.#files.has(normalizedPath)) {
      throw new Error(`File already exists: ${normalizedPath}`)
    }

    const extension = normalizedPath.split('.').pop()

    let newFile: File | JsonFile
    switch (extension) {
      case 'json':
        newFile = new JsonFile({ path: normalizedPath, content: {} })
        break
      default:
        newFile = new File({ path: normalizedPath, settings: this.settings })
        break
    }

    this.#files.set(normalizedPath, newFile)

    return newFile
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
  findDefinition({ name, exportPath }: PickArgs): Definition | undefined {
    const file = this.#getFile(exportPath)

    invariant(file instanceof File, `File at "${exportPath}" is not a "File" type`)

    return file.definitions.get(name)
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
const matchesPathFilter = ({
  paths,
  path,
  method,
  variant
}: MatchesPathFilterArgs): boolean => {
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
}

/**
 * Creates a ModelSource from a reference name and generator ID.
 *
 * Transforms model reference and generator information into a source descriptor
 * that can be used for tracking model origins in the generation pipeline.
 *
 * @param args - Arguments containing reference name and generator ID
 * @returns ModelSource descriptor for the model
 */
export const toModelSource = ({ refName, generatorId }: ToModelSourceArgs): ModelSource => ({
  type: 'model',
  generatorId,
  refName
})

const toSkipPaths = (
  skip: SkipOperations | SkipModels | undefined,
  generatorId: string
): SkipPaths | undefined => {
  const generatorSkip = skip?.[generatorId]

  if (typeof generatorSkip === 'object' && !Array.isArray(generatorSkip)) {
    return generatorSkip
  }

  return undefined
}

const toSkipModels = (
  skip: SkipOperations | SkipModels | undefined,
  generatorId: string
): string[] | undefined => {
  const generatorSkip = skip?.[generatorId]

  if (Array.isArray(generatorSkip)) {
    return generatorSkip
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

  if (typeof generatorInclude === 'object' && !Array.isArray(generatorInclude)) {
    return generatorInclude
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
): string[] | undefined => {
  const generatorInclude = include?.[generatorId]

  if (Array.isArray(generatorInclude)) {
    return generatorInclude
  }

  return undefined
}
