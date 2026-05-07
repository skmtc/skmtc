import { normalize } from '@std/path/normalize'
import { Import } from '@/dsl/Import.ts'
import { Definition } from '@/dsl/Definition.ts'
import type { OasDocument } from '@/oas/document/Document.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import type { SkmtcDocument } from '@/types/SkmtcDocument.ts'
import type {
  BuildModelSettingsArgs,
  DefineAndRegisterArgs,
  GenerateContextType,
  GenerateResult,
  GetFileOptions,
  InsertGqlOperationArgs,
  InsertModelOptions,
  InsertNormalisedModelArgs,
  InsertNormalisedModelOptions,
  InsertNormalisedModelReturn,
  InsertOperationArgs,
  PickArgs,
  RegisterArgs,
  RegisterJsonArgs,
  ToGqlOperationSettingsArgs,
  ToOperationSettingsArgs
} from './generateTypes.ts'
import type { ClientSettings, SkipModels, SkipOperations, SkipPaths } from '@/types/Settings.ts'
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
   * Source document for generation, wrapped in the {@link SkmtcDocument}
   * discriminated union. Generators that target a specific protocol
   * narrow on `document.type` (or use the `oasDocument` / `gqlDocument`
   * convenience accessors which throw on a protocol mismatch).
   */
  document: SkmtcDocument
  settings: ClientSettings | undefined
  logger: log.Logger
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void
  toGeneratorConfigMap: () => GeneratorsMapContainer
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
  #previews: Record<string, Record<string, Preview>>
  #mappings: Record<string, Record<string, Mapping>>
  /**
   * Parsed source document, wrapped in the {@link SkmtcDocument}
   * discriminated union. Canonical representation; both protocol-neutral
   * (model) and protocol-specific (operation) dispatch reads through this.
   */
  document: SkmtcDocument
  /** Client settings for customization (optional) */
  settings: ClientSettings | undefined
  /** Logger instance for tracking generation progress */
  logger: Logger
  /** Function to capture processing results at current stack position */
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void
  /** Function that returns the generator configuration map */
  toGeneratorConfigMap: () => GeneratorsMapContainer

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
   * Convenience accessor returning the underlying `OasDocument`.
   *
   * Throws if the current document's protocol is not `'oas'`. The
   * dispatcher guarantees HTTP-protocol operation generators are only
   * invoked when this is safe; this getter exists so existing generator
   * code that reads `context.oasDocument` keeps working without each
   * generator having to narrow the discriminated union itself.
   *
   * Generators that intentionally span both protocols should read
   * `context.document` and switch on `document.type` instead.
   */
  get oasDocument(): OasDocument {
    if (this.document.type !== 'oas') {
      throw new Error(
        `Expected an OAS document but got '${this.document.type}'. ` +
          `Use context.document and switch on document.type for protocol-aware generators.`
      )
    }
    return this.document.value
  }

  /**
   * Convenience accessor returning the underlying `GqlDocument`.
   *
   * Throws if the current document's protocol is not `'gql'`. See
   * {@link GenerateContext.oasDocument} for the rationale; the same
   * dispatcher guarantee applies for GraphQL operation generators.
   */
  get gqlDocument(): GqlDocument {
    if (this.document.type !== 'gql') {
      throw new Error(
        `Expected a GQL document but got '${this.document.type}'. ` +
          `Use context.document and switch on document.type for protocol-aware generators.`
      )
    }
    return this.document.value
  }

  /**
   * @internal
   */
  toArtifacts(stackTrail: StackTrail): GenerateResult {
    const generators: GeneratorConfig[] = Object.values(this.toGeneratorConfigMap())

    generators.forEach(generatorConfig => {
      stackTrail.trace(generatorConfig.id, st => {
        if (this.settings?.skip?.includes(generatorConfig.id)) {
          return
        }

        const skip: SkipOperations | SkipModels | undefined = this.settings?.skip?.find(
          (skip): skip is SkipOperations | SkipModels => {
            return typeof skip === 'object' && Boolean(skip[generatorConfig.id])
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
              toSkipPaths(skip, generatorConfig.id),
              st
            )
            break
          case 'gqlOperation':
            if (this.document.type !== 'gql') {
              // Generator targets GraphQL; current document is OAS — skip silently.
              return
            }
            this.#runGqlOperationGenerator(this.document.value, generatorConfig, st)
            break
          case 'model':
            this.#runModelGenerator(
              this.document,
              generatorConfig,
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
    skip: SkipPaths | undefined,
    stackTrail: StackTrail
  ) {
    oasDocument.operations.reduce((acc, operation) => {
      return stackTrail.trace(`${operation.path}:${operation.method}`, st => {
        try {
          if (
            typeof generatorConfig?.isSupported === 'function' &&
            !generatorConfig.isSupported({ operation, context: this })
          ) {
            this.captureCurrentResult('notSupported', st)
            return acc
          }

          if (skip?.[operation.path]?.includes(operation.method)) {
            this.captureCurrentResult('skipped', st)
            return acc
          }

          const result = generatorConfig.transform({ context: this, operation, acc })

          const source = toOasOperationSource({ operation, generatorId: generatorConfig.id })

          this.#addPreview(source, generatorConfig.toPreviewModule?.({ context: this, operation }))

          this.#addMapping(source, generatorConfig.toMappingModule?.({ context: this, operation }))

          this.captureCurrentResult('success', st)

          return result
        } catch (error) {
          this.logger.error(error)

          this.captureCurrentResult('error', st)
        }
      })
    }, undefined)
  }

  #runGqlOperationGenerator(
    gqlDocument: GqlDocument,
    generatorConfig: GqlOperationConfig,
    stackTrail: StackTrail
  ) {
    gqlDocument.operations.reduce<unknown>((acc, operation) => {
      return stackTrail.trace(operation.identifier, st => {
        try {
          if (
            typeof generatorConfig.isSupported === 'function' &&
            !generatorConfig.isSupported({ operation, context: this })
          ) {
            this.captureCurrentResult('notSupported', st)
            return acc
          }

          const result = generatorConfig.transform({ context: this, operation, acc })

          const source = toGqlOperationSource({ operation, generatorId: generatorConfig.id })

          this.#addPreview(source, generatorConfig.toPreviewModule?.({ context: this, operation }))

          this.#addMapping(source, generatorConfig.toMappingModule?.({ context: this, operation }))

          this.captureCurrentResult('success', st)
          return result
        } catch (error) {
          this.logger.error(error)
          this.captureCurrentResult('error', st)
          return acc
        }
      })
    }, undefined)
  }

  #runModelGenerator(
    document: SkmtcDocument,
    generatorConfig: ModelConfig,
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

    if (!this.#previews[module.group]) {
      this.#previews[module.group] = {}
    }

    if (this.#previews[module.group][module.name]) {
      throw new Error(`Cannot override preview module "${module.name}" in group "${module.group}"`)
    }

    this.#previews[module.group][module.name] = {
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

    if (!this.#mappings[module.group]) {
      this.#mappings[module.group] = {}
    }

    if (this.#mappings[module.group][module.name]) {
      throw new Error(`Cannot override mapping module "${module.name}" in group "${module.group}"`)
    }

    this.#mappings[module.group][module.name] = {
      module,
      source
    }
  }

  #getFile(filePath: string, { throwIfNotFound = false }: GetFileOptions = {}): File | JsonFile {
    const normalisedPath = normalize(filePath)

    const currentFile = this.#files.get(normalisedPath)

    if (!currentFile) {
      if (throwIfNotFound) {
        throw new Error(`File not found: '${normalisedPath}'`)
      } else {
        return this.#addFile(normalisedPath)
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
    if (isGqlInsertOperationArgs(args)) {
      const { settings, definition } = new GqlOperationDriver({
        context: this,
        projection: args.projection,
        operation: args.operation,
        destinationPath: args.destinationPath,
        noExport: args.noExport ?? false
      })

      return new Inserted({ settings, definition })
    }

    const { settings, definition } = new OasOperationDriver({
      context: this,
      projection: args.projection,
      operation: args.operation,
      destinationPath: args.destinationPath,
      noExport: args.noExport ?? false
    })

    return new Inserted({ settings, definition })
  }

  /**
   * Insert a normalized model: dispatch to {@link insertModel} when the schema
   * is a `$ref`, otherwise produce a one-off definition under `fallbackName`.
   */
  insertNormalisedModel<
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType
  >(
    projection: ModelProjection<V, EnrichmentType>,
    { schema, fallbackName, destinationPath }: InsertNormalisedModelArgs<Schema>,
    { noExport = false }: InsertNormalisedModelOptions = {}
  ): InsertNormalisedModelReturn<V, Schema> {
    if (schema.isRef()) {
      const { definition } = this.insertModel(projection, schema.toRefName(), {
        destinationPath,
        noExport
      })

      // @TODO Using mapped types would help avoid generics casting
      return definition as InsertNormalisedModelReturn<V, Schema>
    }

    const cachedDefinition = this.findDefinition({
      name: fallbackName,
      exportPath: destinationPath
    })

    // @TODO add check to make sure retrieved definition
    // used same generator and same schema #SKM-47
    if (cachedDefinition) {
      return cachedDefinition as InsertNormalisedModelReturn<V, Schema>
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
    return definition as InsertNormalisedModelReturn<V, Schema>
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
    if (isGqlToOperationSettingsArgs(args)) {
      return new ContentSettings<EnrichmentType>({
        identifier: args.projection.toIdentifier(args.operation),
        exportPath: args.projection.toExportPath(args.operation),
        enrichments: args.projection.toEnrichments({ operation: args.operation, context: this })
      })
    }

    return new ContentSettings<EnrichmentType>({
      identifier: args.projection.toIdentifier(args.operation),
      exportPath: args.projection.toExportPath(args.operation),
      enrichments: args.projection.toEnrichments({ operation: args.operation, context: this })
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
    return new ContentSettings<EnrichmentType>({
      identifier: projection.toIdentifier(refName),
      exportPath: projection.toExportPath(refName),
      enrichments: projection.toEnrichments({ refName, context: this })
    })
  }

  #addFile(normalisedPath: string): File | JsonFile {
    if (this.#files.has(normalisedPath)) {
      throw new Error(`File already exists: ${normalisedPath}`)
    }

    const extension = normalisedPath.split('.').pop()

    let newFile: File | JsonFile
    switch (extension) {
      case 'json':
        newFile = new JsonFile({ path: normalisedPath, content: {} })
        break
      default:
        newFile = new File({ path: normalisedPath, settings: this.settings })
        break
    }

    this.#files.set(normalisedPath, newFile)

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

type ToOasOperationSourceArgs = {
  operation: OasOperation
  generatorId: string
}

/**
 * Creates an OasOperationSource from an operation and generator ID.
 *
 * Transforms operation and generator information into a source descriptor
 * that can be used for tracking operation origins in the generation pipeline.
 *
 * @param args - Arguments containing operation and generator ID
 * @returns OasOperationSource descriptor for the operation
 */
export const toOasOperationSource = ({
  operation,
  generatorId
}: ToOasOperationSourceArgs): OasOperationSource => ({
  type: 'oasOperation',
  generatorId,
  operationPath: operation.path,
  operationMethod: operation.method
})

type ToGqlOperationSourceArgs = {
  operation: GqlOperation
  generatorId: string
}

/**
 * Creates a GraphQL operation source descriptor.
 *
 * Sibling to {@link toOasOperationSource} for the GraphQL protocol — encodes
 * `rootKind` and `fieldName` instead of `path` / `method`.
 */
export const toGqlOperationSource = ({
  operation,
  generatorId
}: ToGqlOperationSourceArgs): GqlOperationSource => ({
  type: 'gqlOperation',
  generatorId,
  rootKind: operation.rootKind,
  fieldName: operation.fieldName
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
