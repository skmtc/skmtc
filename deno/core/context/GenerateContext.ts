import { normalize } from '@std/path/normalize'
import type { ImportNameArg } from '../dsl/Import.ts'
import { Import } from '../dsl/Import.ts'
import { Definition } from '../dsl/Definition.ts'
import type { OasDocument } from '../oas/document/Document.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import type { OasRef } from '../oas/ref/Ref.ts'
import type { GetFileOptions } from './types.ts'
import type { ClientSettings, SkipModels, SkipOperations, SkipPaths } from '../types/Settings.ts'
import type { Method } from '../types/Method.ts'
import type { OperationConfig, OperationInsertable } from '../dsl/operation/types.ts'
import type { OasOperation } from '../oas/operation/Operation.ts'
import type { ModelConfig, ModelInsertable } from '../dsl/model/types.ts'
import { OperationDriver } from '../dsl/operation/OperationDriver.ts'
import { ModelDriver } from '../dsl/model/ModelDriver.ts'
import type { GenerationType, GeneratedValue } from '../types/GeneratedValue.ts'
import { ContentSettings } from '../dsl/ContentSettings.ts'
import type { RefName } from '../types/RefName.ts'
import * as Sentry from 'npm:@sentry/node@^10.8.0'
import type * as log from '@std/log'
import type { Logger } from '../types/Logger.ts'
import type { ResultType } from '../types/Results.ts'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import type { Identifier } from '../dsl/Identifier.ts'
import type {
  SchemaToNonRef,
  SchemaToValueFn,
  SchemaType,
  TypeSystemOutput
} from '../types/TypeSystem.ts'
import { Inserted } from '../dsl/Inserted.ts'
import { File } from '../dsl/File.ts'
import { JsonFile } from '../dsl/JsonFile.ts'
import invariant from 'tiny-invariant'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type {
  OperationSource,
  ModelSource,
  Preview,
  PreviewModule,
  MappingModule,
  Mapping
} from '../types/Preview.ts'
import { match } from 'ts-pattern'
import type { OasVoid } from '../oas/void/Void.ts'

type ConstructorArgs = {
  oasDocument: OasDocument
  settings: ClientSettings | undefined
  logger: log.Logger
  stackTrail: StackTrail
  captureCurrentResult: (result: ResultType) => void
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
}

/**
 * Arguments for picking a specific export from a generator module.
 *
 * Used to select and configure specific exports from generator modules
 * during the artifact generation process.
 */
export type PickArgs = {
  /** The name of the export to pick from the generator module */
  name: string
  /** The file path where the export should be made available */
  exportPath: string
}

/**
 * Arguments for registering a JSON file in the generation context.
 *
 * Used to register JSON configuration files, manifests, or other JSON
 * data that should be included in the generated output artifacts.
 */
export type RegisterJsonArgs = {
  /** The destination file path where the JSON should be written */
  destinationPath: string
  /** The JSON object to write to the file */
  json: Record<string, unknown>
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
 * Base arguments for registering generated content in the generation context.
 *
 * Provides the fundamental configuration options for registering imports,
 * re-exports, and definitions that will be included in generated files.
 */
export type BaseRegisterArgs = {
  /** Import statements to include, organized by module path */
  imports?: Record<string, ImportNameArg[]>
  /** Re-export statements to include, organized by module path */
  reExports?: Record<string, Identifier[]>
  /** Definition objects to include in the generated content */
  definitions?: (Definition | undefined)[]
}

/**
 * Arguments for registering generated content with a specific destination.
 *
 * Extends BaseRegisterArgs to include a destination path, allowing content
 * to be registered and associated with a specific output file location.
 */
export type RegisterArgs = {
  /** Import statements to include, organized by module path */
  imports?: Record<string, ImportNameArg[]>
  /** Re-export statements to include, organized by module path */
  reExports?: Record<string, Identifier[]>
  /** Definition objects to include in the generated content */
  definitions?: (Definition | undefined)[]
  /** The destination file path where the content should be registered */
  destinationPath: string
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
 * Arguments for defining and registering a value in the generation context.
 *
 * Used to create definitions from pre-generated values and register them
 * in the generation context for inclusion in output files.
 *
 * @template V - The generated value type extending GeneratedValue
 */
export type DefineAndRegisterArgs<V extends GeneratedValue> = {
  /** The identifier for the definition */
  identifier: Identifier
  /** The generated value to define */
  value: V
  /** The destination file path where the definition should be registered */
  destinationPath: string
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
 * Options for inserting an operation into the generation context.
 *
 * Configures how an OpenAPI operation should be processed and
 * included in the generated code output.
 *
 * @template T - The generation type extending GenerationType
 */
export type InsertOperationOptions<T extends GenerationType> = {
  /** Whether to exclude this operation from exports */
  noExport?: boolean
  /** The type of generation to apply */
  generation?: T
  /** Custom destination path for the operation */
  destinationPath?: string
}

/**
 * Arguments for inserting a normalized model into the generation context.
 *
 * Used to process and register OpenAPI schema objects as normalized
 * model definitions with fallback naming when schema names are unavailable.
 *
 * @template Schema - The schema type (OasSchema, OasRef, or OasVoid)
 */
export type InsertNormalisedModelArgs<Schema extends OasSchema | OasRef<'schema'> | OasVoid> = {
  /** Fallback name to use if the schema doesn't have a name */
  fallbackName: string
  /** The OpenAPI schema to normalize and insert */
  schema: Schema
  /** The destination file path for the model */
  destinationPath: string
}

/**
 * Options for inserting a normalized model.
 *
 * Configures how a normalized model should be processed and
 * included in the generated code output.
 */
export type InsertNormalisedModelOptions = {
  /** Whether to exclude this model from exports */
  noExport?: boolean
}

/**
 * Return type for inserting a normalized model.
 *
 * Provides type-safe return values based on the schema type being processed.
 * Returns different Definition types depending on whether the schema is a
 * reference or a concrete schema.
 *
 * @template V - The generated value type
 * @template Schema - The schema type being processed
 */
export type InsertNormalisedModelReturn<
  V extends GeneratedValue,
  Schema extends OasSchema | OasRef<'schema'> | OasVoid
> =
  Schema extends OasRef<'schema'>
    ? Definition<V>
    : Definition<TypeSystemOutput<SchemaToNonRef<Schema>['type']>>

/**
 * Options for inserting a model into the generation context.
 *
 * Configures how a model should be processed and included in
 * the generated code output.
 *
 * @template T - The generation type extending GenerationType
 */
export type InsertModelOptions<T extends GenerationType> = {
  /** Whether to exclude this model from exports */
  noExport?: boolean
  /** The type of generation to apply */
  generation?: T
  /** Custom destination path for the model */
  destinationPath?: string
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
export type InsertReturn<
  V extends GeneratedValue,
  T extends GenerationType,
  EnrichmentType
> = Inserted<V, T, EnrichmentType>

/**
 * Arguments for generating operation content settings.
 *
 * @template V - The value type for the operation
 * @template EnrichmentType - Optional enrichment type for the operation
 */
export type ToOperationSettingsArgs<V, EnrichmentType = undefined> = {
  operation: OasOperation
  insertable: OperationInsertable<V, EnrichmentType>
}

/**
 * Arguments for building model content settings.
 *
 * @template V - The value type for the model
 * @template EnrichmentType - Optional enrichment type for the model
 */
export type BuildModelSettingsArgs<V, EnrichmentType = undefined> = {
  refName: RefName
  insertable: ModelInsertable<V, EnrichmentType>
}

type GenerateResult = {
  files: Map<string, File | JsonFile>
  previews: Record<string, Record<string, Preview>>
  mappings: Record<string, Record<string, Mapping>>
}

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
 * import { ModelBase } from '@skmtc/core';
 *
 * class TypeScriptInterface extends ModelBase {
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
 *
 * @example Operation generator usage
 * ```typescript
 * class ApiClientGenerator extends OperationBase {
 *   generate(): Definition {
 *     const operation = this.context.getOperation(this.path, this.method);
 *
 *     const functionName = this.context.createOperationName(this.path, this.method);
 *
 *     return new Definition({
 *       context: this.context,
 *       identifier: Identifier.createVariable(functionName),
 *       value: {
 *         generatorKey: this.generatorKey,
 *         content: this.generateClientFunction(operation)
 *       }
 *     });
 *   }
 * }
 * ```
 *
 * @example Schema and type system integration
 * ```typescript
 * class MyGenerator extends ModelBase {
 *   generate(): Definition {
 *     const schema = this.context.getSchema(this.refName);
 *
 *     // Transform schema using type system
 *     const typeOutput = this.context.transformSchema(schema, {
 *       stringType: 'string',
 *       numberType: 'number',
 *       arrayType: (items) => `Array<${items}>`
 *     });
 *
 *     // Register dependencies
 *     if (schema.hasReferences()) {
 *       this.context.addImportsToFile('./models/types.ts', {
 *         './common': ['BaseModel']
 *       });
 *     }
 *
 *     return new Definition({
 *       context: this.context,
 *       identifier: Identifier.createType(this.refName),
 *       value: {
 *         generatorKey: this.generatorKey,
 *         content: typeOutput.content
 *       }
 *     });
 *   }
 * }
 * ```
 */
export class GenerateContext {
  #files: Map<string, File | JsonFile>
  #previews: Record<string, Record<string, Preview>>
  #mappings: Record<string, Record<string, Mapping>>
  /** The parsed OpenAPI document being processed */
  oasDocument: OasDocument
  /** Client settings for customization (optional) */
  settings: ClientSettings | undefined
  /** Logger instance for tracking generation progress */
  logger: Logger
  /** Function to capture processing results at current stack position */
  captureCurrentResult: (result: ResultType) => void
  /** Function that returns the generator configuration map */
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  /** Stack trail for tracking current processing context */
  stackTrail: StackTrail
  /** Tracking model nesting depth to prevent infinite recursion */
  modelDepth: Record<string, number>
  /**
   * Creates a new GenerateContext instance for the generation phase.
   *
   * @param args - Constructor arguments including document, settings, and handlers
   */
  constructor({
    oasDocument,
    settings,
    logger,
    captureCurrentResult,
    stackTrail,
    toGeneratorConfigMap
  }: ConstructorArgs) {
    this.logger = logger
    this.#files = new Map()
    this.#previews = {}
    this.#mappings = {}
    this.oasDocument = oasDocument
    this.settings = settings
    this.stackTrail = stackTrail
    this.captureCurrentResult = captureCurrentResult
    this.toGeneratorConfigMap = toGeneratorConfigMap
    this.modelDepth = {}
  }

  /**
   * @internal
   */
  toArtifacts(): GenerateResult {
    const generators = Object.values(this.toGeneratorConfigMap())

    Sentry.startSpan({ name: 'toArtifacts' }, () =>
      generators.forEach(generatorConfig => {
        this.trace(generatorConfig.id, () => {
          if (this.settings?.skip?.includes(generatorConfig.id)) {
            return
          }

          const skip: SkipOperations | SkipModels | undefined = this.settings?.skip?.find(
            (skip): skip is SkipOperations | SkipModels => {
              return typeof skip === 'object' && Boolean(skip[generatorConfig.id])
            }
          )

          match(generatorConfig.type)
            .with('operation', () =>
              this.#runOperationGenerator(
                this.oasDocument,
                generatorConfig,
                toSkipPaths(skip, generatorConfig.id)
              )
            )
            .with('model', () =>
              this.#runModelGenerator(
                this.oasDocument,
                generatorConfig,
                toSkipModels(skip, generatorConfig.id)
              )
            )
            .otherwise(matched => {
              throw new Error(`Invalid generator type: '${matched}' on ${generatorConfig.id}`)
            })
        })
      })
    )

    return {
      files: this.#files,
      previews: this.#previews,
      mappings: this.#mappings
    }
  }
  #runOperationGenerator(
    oasDocument: OasDocument,
    generatorConfig: OperationConfig,
    skip: SkipPaths | undefined
  ) {
    oasDocument.operations.reduce((acc, operation) => {
      return this.trace([operation.path, operation.method], () => {
        try {
          if (
            typeof generatorConfig?.isSupported === 'function' &&
            !generatorConfig.isSupported({ operation, context: this })
          ) {
            this.captureCurrentResult('notSupported')
            return acc
          }

          if (skip?.[operation.path]?.includes(operation.method)) {
            this.captureCurrentResult('skipped')
            return acc
          }

          const result = generatorConfig.transform({ context: this, operation, acc })

          const source = toOperationSource({ operation, generatorId: generatorConfig.id })

          this.#addPreview(source, generatorConfig.toPreviewModule?.({ context: this, operation }))

          this.#addMapping(source, generatorConfig.toMappingModule?.({ context: this, operation }))

          this.captureCurrentResult('success')

          return result
        } catch (error) {
          this.logger.error(error)

          this.captureCurrentResult('error')
        }
      })
    }, undefined)
  }

  #runModelGenerator(
    oasDocument: OasDocument,
    generatorConfig: ModelConfig,
    skip: string[] | undefined
  ) {
    const refNames = oasDocument.components?.toSchemasRefNames() ?? []

    return refNames.reduce((acc, refName) => {
      return this.trace(refName, () => {
        try {
          if (skip?.includes(refName)) {
            this.captureCurrentResult('skipped')
            return acc
          }

          const result = generatorConfig.transform({ context: this, refName, acc })

          const source = toModelSource({ refName, generatorId: generatorConfig.id })

          this.#addPreview(source, generatorConfig.toPreviewModule?.({ context: this, refName }))

          this.#addMapping(source, generatorConfig.toMappingModule?.({ context: this, refName }))

          this.captureCurrentResult('success')

          return result
        } catch (error) {
          this.logger.error(error)
          this.captureCurrentResult('error')
        }
      })
    }, undefined)
  }

  #addPreview(source: OperationSource | ModelSource, module: PreviewModule | undefined) {
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

  #addMapping(source: OperationSource | ModelSource, module: MappingModule | undefined) {
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

  /**
   * Executes a function within a traced context for debugging and monitoring.
   *
   * @param token - Trace identifier or path segments
   * @param fn - Function to execute within the trace context
   * @returns The result of the traced function execution
   */
  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.stackTrail, token, fn, this.logger)
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
   * 1. Generate content settings for the supplied operation
   * 2. Look up definition in file with path `destinationPath`
   * 3. If definition is not found, it will create a new one and register it
   * 4. If the definition is defined at a location that is different from
   *    the current file, it will add an import to the current file from
   *    that location
   * 5. Use the content settings to generate the operation using the
   *    insertable's driver
   * @mutates this.files
   */
  insertOperation<V extends GeneratedValue, T extends GenerationType, EnrichmentType = undefined>(
    insertable: OperationInsertable<V, EnrichmentType>,
    operation: OasOperation,
    { generation, destinationPath, noExport = false }: InsertOperationOptions<T> = {}
  ): Inserted<V, T, EnrichmentType> {
    const { settings, definition } = new OperationDriver({
      context: this,
      insertable,
      operation,
      generation,
      destinationPath,
      noExport
    })

    return new Inserted({ settings, definition })
  }

  /**
   * Inserts a normalized model definition into the generation context.
   *
   * @param insertable - Model insertable configuration with prototype and transform functions
   * @param schema - OAS schema, reference, or void type to generate model from
   * @param options - Insertion options including generation type and destination
   * @returns Inserted model instance with settings and definition
   */
  insertNormalisedModel<
    V extends GeneratedValue,
    Schema extends OasSchema | OasRef<'schema'> | OasVoid,
    EnrichmentType
  >(
    insertable: ModelInsertable<V, EnrichmentType>,
    { schema, fallbackName, destinationPath }: InsertNormalisedModelArgs<Schema>,
    { noExport = false }: InsertNormalisedModelOptions = {}
  ): InsertNormalisedModelReturn<V, Schema> {
    if (schema.isRef()) {
      const { definition } = this.insertModel(insertable, schema.toRefName(), {
        generation: 'force',
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

    const value = insertable.schemaToValueFn({
      context: this,
      schema,
      destinationPath,
      required: true
    })

    const definition = this.#defineAndRegister({
      identifier: insertable.createIdentifier(fallbackName),
      value,
      destinationPath,
      noExport
    })

    // @TODO Using mapped types would help avoid generics casting
    return definition as InsertNormalisedModelReturn<V, Schema>
  }

  /**
   * Insert model into the output file with path `destinationPath`.
   *
   * Insert will perform the following steps:
   * 1. Generate content settings for the supplied model
   * 2. Look up definition in file with path `destinationPath`
   * 3. If definition is not found, it will create a new one and register it
   * 4. If the definition is defined at a location that is different from
   *    the current file, it will add an import to the current file from
   *    that location
   * 5. Use the content settings to generate the model using the
   *    insertable's driver
   * @mutates this.files
   */

  insertModel<V extends GeneratedValue, T extends GenerationType, EnrichmentType>(
    insertable: ModelInsertable<V, EnrichmentType>,
    refName: RefName,
    { generation, destinationPath, noExport = false }: InsertModelOptions<T> = {}
  ): Inserted<V, T, EnrichmentType> {
    const { settings, definition } = new ModelDriver({
      context: this,
      insertable,
      refName,
      generation,
      destinationPath,
      rootRef: refName,
      noExport
    })

    return new Inserted({ settings, definition })
  }

  /**
   * Generate and return content settings for operation insertable and
   * operation.
   *
   * Content settings are produced by passing base settings and operation
   * through toIdentifier and toExportPath static methods on the
   * insertable.
   * @param { operation, insertable }
   * @returns
   */
  toOperationContentSettings<V, EnrichmentType>({
    operation,
    insertable
  }: ToOperationSettingsArgs<V, EnrichmentType>): ContentSettings<EnrichmentType> {
    return new ContentSettings<EnrichmentType>({
      identifier: insertable.toIdentifier(operation),
      exportPath: insertable.toExportPath(operation),
      enrichments: insertable.toEnrichments({ operation, context: this })
    })
  }

  /**
   * Generate and return content settings for model insertable and refName.
   *
   * Content settings are produced by passing base settings and refName
   * through toIdentifier and toExportPath static methods on the
   * insertable.
   * @param { refName, insertable }
   * @returns Content settings for model
   */
  toModelContentSettings<V, EnrichmentType>({
    refName,
    insertable
  }: BuildModelSettingsArgs<V, EnrichmentType>): ContentSettings<EnrichmentType> {
    return new ContentSettings<EnrichmentType>({
      identifier: insertable.toIdentifier(refName),
      exportPath: insertable.toExportPath(refName),
      enrichments: insertable.toEnrichments({ refName, context: this })
    })
  }

  #addFile(normalisedPath: string): File | JsonFile {
    if (this.#files.has(normalisedPath)) {
      throw new Error(`File already exists: ${normalisedPath}`)
    }

    const extension = normalisedPath.split('.').pop()

    const newFile = match(extension)
      .with('json', () => new JsonFile({ path: normalisedPath, content: {} }))
      .otherwise(() => new File({ path: normalisedPath, settings: this.settings }))

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

    const schema = this.oasDocument.components?.schemas?.[refName]?.resolveOnce()

    if (!schema) {
      throw new Error(`Schema not found: ${refName}`)
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

type ToOperationSourceArgs = {
  operation: OasOperation
  generatorId: string
}

/**
 * Creates an OperationSource from an operation and generator ID.
 *
 * Transforms operation and generator information into a source descriptor
 * that can be used for tracking operation origins in the generation pipeline.
 *
 * @param args - Arguments containing operation and generator ID
 * @returns OperationSource descriptor for the operation
 */
export const toOperationSource = ({
  operation,
  generatorId
}: ToOperationSourceArgs): OperationSource => ({
  type: 'operation',
  generatorId,
  operationPath: operation.path,
  operationMethod: operation.method
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
