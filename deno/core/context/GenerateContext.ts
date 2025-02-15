import { normalize } from 'jsr:@std/path@1.0.6'
import type { ImportNameArg } from '../dsl/Import.ts'
import { Import } from '../dsl/Import.ts'
import { Definition } from '../dsl/Definition.ts'
import type { OasDocument } from '../oas/document/Document.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import type { OasRef } from '../oas/ref/Ref.ts'
import type { GetFileOptions } from './types.ts'
import type { ClientSettings, EnrichedSetting } from '../types/Settings.ts'
import type { Method } from '../types/Method.ts'
import type { OperationConfig, OperationInsertable } from '../dsl/operation/types.ts'
import type { OasOperation } from '../oas/operation/Operation.ts'
import type { ModelConfig, ModelInsertable } from '../dsl/model/types.ts'
import { OperationDriver } from '../dsl/operation/OperationDriver.ts'
import { ModelDriver } from '../dsl/model/ModelDriver.ts'
import type { GenerationType, GeneratedValue } from '../types/GeneratedValue.ts'
import { ContentSettings } from '../dsl/ContentSettings.ts'
import type { RefName } from '../types/RefName.ts'
import * as Sentry from 'npm:@sentry/deno@8.47.0'
import type * as log from 'jsr:@std/log@^0.224.6'
import type { GeneratorKey } from '../types/GeneratorKeys.ts'
import type { ResultType } from '../types/Results.ts'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import type { Identifier } from '../dsl/Identifier.ts'
import type { SchemaToValueFn, SchemaType, TypeSystemOutput } from '../types/TypeSystem.ts'
import { Inserted } from '../dsl/Inserted.ts'
import { File } from '../dsl/File.ts'
import invariant from 'tiny-invariant'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { Preview } from '../types/Preview.ts'
import { match } from 'ts-pattern'

type ConstructorArgs = {
  oasDocument: OasDocument
  settings: ClientSettings | undefined
  logger: log.Logger
  callback: (generatorKey: GeneratorKey) => void
  stackTrail: StackTrail
  captureCurrentResult: (result: ResultType) => void
  toGeneratorConfigMap: <EnrichmentType>() => GeneratorsMapContainer<EnrichmentType>
}

export type PickArgs = {
  name: string
  exportPath: string
}

export type ApplyPackageImportsArgs = {
  destinationPath: string
  exportPath: string
}

export type BaseRegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, Identifier[]>
  definitions?: (Definition | undefined)[]
  preview?: {
    [group: string]: Omit<Preview, 'group' | 'exportPath' | 'source'>
  }
}

export type RegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, Identifier[]>
  definitions?: (Definition | undefined)[]
  preview?: {
    [group: string]: Omit<Preview, 'group' | 'exportPath'>
  }
  destinationPath: string
}

export type CreateAndRegisterDefinition<Schema extends SchemaType> = {
  schema: Schema
  identifier: Identifier
  destinationPath: string
  schemaToValueFn: SchemaToValueFn
}

export type DefineAndRegisterArgs<V extends GeneratedValue> = {
  identifier: Identifier
  value: V
  destinationPath: string
}

export type GetOperationSettingsArgs = {
  generatorId: string
  path: string
  method: Method
}

export type AddRenderDependencyArgs = {
  generatorId: string
  operation: OasOperation
  dependencies: string[]
}

export type ToModelSettingsArgs = {
  generatorId: string
  refName: RefName
}

export type InsertOperationArgs<
  V extends GeneratedValue,
  T extends GenerationType,
  EnrichmentType
> = {
  insertable: OperationInsertable<V, EnrichmentType>
  operation: OasOperation
  generation?: T
  destinationPath?: string
}

export type InsertModelArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
  insertable: ModelInsertable<V, EnrichmentType>
  refName: RefName
  generation?: T
  destinationPath?: string
}

export type InsertReturn<
  V extends GeneratedValue,
  T extends GenerationType,
  EnrichmentType
> = Inserted<V, T, EnrichmentType>

type RunOperationGeneratorArgs<EnrichmentType> = {
  oasDocument: OasDocument
  generatorConfig: OperationConfig<EnrichmentType>
}

type RunModelGeneratorArgs<EnrichmentType> = {
  oasDocument: OasDocument
  generatorConfig: ModelConfig<EnrichmentType>
}

type ToOperationSettingsArgs<V, EnrichmentType> = {
  operation: OasOperation
  insertable: OperationInsertable<V, EnrichmentType>
}

type BuildModelSettingsArgs<V, EnrichmentType> = {
  refName: RefName
  insertable: ModelInsertable<V, EnrichmentType>
}

type GenerateResult = {
  files: Map<string, File>
  previews: Record<string, Record<string, Preview>>
}

export class GenerateContext {
  #files: Map<string, File>
  #previews: Record<string, Record<string, Preview>>
  oasDocument: OasDocument
  settings: ClientSettings | undefined
  logger: log.Logger
  callback: (generatorKey: GeneratorKey) => void
  captureCurrentResult: (result: ResultType) => void
  toGeneratorConfigMap: <EnrichmentType>() => GeneratorsMapContainer<EnrichmentType>

  #stackTrail: StackTrail

  constructor({
    oasDocument,
    settings,
    logger,
    callback,
    captureCurrentResult,
    stackTrail,
    toGeneratorConfigMap
  }: ConstructorArgs) {
    this.logger = logger
    this.#files = new Map()
    this.#previews = {}
    this.oasDocument = oasDocument
    this.settings = settings
    this.callback = callback
    this.#stackTrail = stackTrail
    this.captureCurrentResult = captureCurrentResult
    this.toGeneratorConfigMap = toGeneratorConfigMap
  }

  /**
   * @internal
   */
  generate(): GenerateResult {
    const generators = Object.values(this.toGeneratorConfigMap())

    Sentry.startSpan({ name: 'Generate' }, () =>
      generators.forEach(generatorConfig => {
        this.trace(generatorConfig.id, () => {
          match(generatorConfig.type)
            .with('operation', () =>
              this.#runOperationGenerator({ oasDocument: this.oasDocument, generatorConfig })
            )
            .with('model', () =>
              this.#runModelGenerator({ oasDocument: this.oasDocument, generatorConfig })
            )
            .otherwise(matched => {
              throw new Error(`Invalid generator type: '${matched}' on ${generatorConfig.id}`)
            })
        })
      })
    )

    return {
      files: this.#files,
      previews: this.#previews
    }
  }

  #runOperationGenerator<EnrichmentType>({
    oasDocument,
    generatorConfig
  }: RunOperationGeneratorArgs<EnrichmentType>) {
    return oasDocument.operations.reduce((acc, operation) => {
      return this.trace([operation.path, operation.method], () => {
        if (!generatorConfig.isSupported({ operation, context: this })) {
          this.captureCurrentResult('notSupported')
          return acc
        }

        const result = generatorConfig.transform({ context: this, operation, acc })

        this.captureCurrentResult('success')

        return result
      })
    }, undefined)
  }

  #runModelGenerator<EnrichmentType>({
    oasDocument,
    generatorConfig
  }: RunModelGeneratorArgs<EnrichmentType>) {
    const refNames = oasDocument.components?.toSchemasRefNames() ?? []

    return refNames.reduce((acc, refName) => {
      return this.trace(refName, () => {
        // if (!generatorConfig.isSupported()) {
        //   this.captureCurrentResult('notSupported')

        //   return acc
        // }

        const result = generatorConfig.transform({ context: this, refName, acc })

        this.captureCurrentResult('success')

        return result
      })
    }, undefined)
  }

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.#stackTrail, token, fn)
  }

  #getFile(filePath: string, { throwIfNotFound = false }: GetFileOptions = {}): File {
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
   * Converts schema to value using `schemaToValueFn` and creates definition
   * with the given `identifier` at `destinationPath`.
   *
   * If a definition with the same name already exists, it will be returned
   * instead of creating a new one.
   *
   * @experimental
   *
   * @param schema - The schema to create the definition for.
   * @param identifier - The identifier for the definition.
   * @param destinationPath - The path to the file where the definition will be registered.
   * @param schemaToValueFn - A function that converts the schema to a value.
   * @returns The created definition or cached definition if it already exists.
   */
  createAndRegisterDefinition<Schema extends SchemaType>({
    schema,
    identifier,
    destinationPath,
    schemaToValueFn
  }: CreateAndRegisterDefinition<Schema>): Definition<TypeSystemOutput<Schema['type']>> {
    const cachedDefinition = this.findDefinition({
      name: identifier.name,
      exportPath: destinationPath
    })

    // @TODO add check to make sure retrieved definition
    // used same generator and same schema #SKM-47
    if (cachedDefinition) {
      return cachedDefinition as Definition<TypeSystemOutput<Schema['type']>>
    }

    const value = schemaToValueFn({
      context: this,
      schema,
      destinationPath,
      required: true
    })

    return this.defineAndRegister({
      identifier,
      value,
      destinationPath
    })
  }

  /**
   * Create and register a definition with the given `identifier` at `destinationPath`.
   *
   * @experimental
   */
  defineAndRegister<V extends GeneratedValue>({
    identifier,
    value,
    destinationPath
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

    const definition = new Definition({
      context: this,
      identifier,
      value
    })

    this.register({
      definitions: [definition],
      destinationPath
    })

    return definition
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
  register({ imports = {}, definitions, destinationPath, reExports, preview }: RegisterArgs) {
    // TODO deduplicate import names and definition names against each other
    const currentFile = this.#getFile(destinationPath)

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

    Object.entries(preview ?? {}).forEach(([group, { name, route, source, input, formatter }]) => {
      if (!this.#previews[group]) {
        this.#previews[group] = {}
      }

      this.#previews[group][name] = {
        name,
        exportPath: destinationPath,
        group,
        route,
        source,
        ...(input ? { input } : {}),
        ...(formatter ? { formatter } : {})
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
  insertOperation<V extends GeneratedValue, T extends GenerationType, ET>({
    insertable,
    operation,
    generation,
    destinationPath
  }: InsertOperationArgs<V, T, ET>): Inserted<V, T, ET> {
    const { settings, definition } = new OperationDriver({
      context: this,
      insertable,
      operation,
      generation,
      destinationPath
    })

    return new Inserted({ settings, definition })
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

  insertModel<V extends GeneratedValue, T extends GenerationType, EnrichmentType>({
    insertable,
    refName,
    generation,
    destinationPath
  }: InsertModelArgs<V, T, EnrichmentType>): Inserted<V, T, EnrichmentType> {
    const { settings, definition } = new ModelDriver({
      context: this,
      insertable,
      refName,
      generation,
      destinationPath
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
    const { selected } = this.toOperationSettings({
      generatorId: insertable.id,
      path: operation.path,
      method: operation.method
    })

    return new ContentSettings<EnrichmentType>({
      selected,
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
    const { selected } = this.toModelSettings({
      generatorId: insertable.id,
      refName
    })

    return new ContentSettings<EnrichmentType>({
      selected,
      identifier: insertable.toIdentifier(refName),
      exportPath: insertable.toExportPath(refName),
      enrichments: insertable.toEnrichments({ refName, context: this })
    })
  }

  /**
   * Look up operation settings for a given generatorId, path and method.
   * @param { generatorId, path, method }
   * @returns Base settings for operation
   */
  toOperationSettings({ generatorId, path, method }: GetOperationSettingsArgs): EnrichedSetting {
    const generatorSettings = this.settings?.generators?.find(({ id }) => id === generatorId)

    const operationSettings =
      generatorSettings && 'operations' in generatorSettings
        ? generatorSettings.operations[path]?.[method]
        : undefined

    return operationSettings ?? { selected: false, enrichments: undefined }
  }

  toModelSettings({ generatorId, refName }: ToModelSettingsArgs): EnrichedSetting {
    const generatorSettings = this.settings?.generators?.find(({ id }) => id === generatorId)

    const modelSettings =
      generatorSettings && 'models' in generatorSettings
        ? generatorSettings.models[refName]
        : undefined

    return modelSettings ?? { selected: false, enrichments: undefined }
  }

  #addFile(normalisedPath: string): File {
    if (this.#files.has(normalisedPath)) {
      throw new Error(`File already exists: ${normalisedPath}`)
    }

    const newFile = new File({ path: normalisedPath, settings: this.settings })

    this.#files.set(normalisedPath, newFile)

    return newFile
  }
  /**
   * Perform one lookup of schema by `refName`.
   * @param refName
   * @returns Matching schema or ref
   * @throws if schema is not found
   */
  resolveSchemaRefOnce(refName: RefName): OasSchema | OasRef<'schema'> {
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
    return this.#getFile(exportPath).definitions.get(name)
  }
}
