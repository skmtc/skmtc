import { normalize } from 'jsr:@std/path@1.0.6'
import type { ImportNameArg } from '../dsl/Import.ts'
import { Import } from '../dsl/Import.ts'
import { Definition } from '../dsl/Definition.ts'
import type { OasDocument } from '../oas/document/Document.ts'
import type { OasSchema } from '../oas/schema/Schema.ts'
import type { OasRef } from '../oas/ref/Ref.ts'
import type { GetFileOptions } from './types.ts'
import type { ClientGeneratorSettings, ClientSettings, EnrichedSetting } from '../types/Settings.ts'
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
import type * as log from 'jsr:@std/log@0.224.6'
import type { ResultType } from '../types/Results.ts'
import type { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import type { Identifier } from '../dsl/Identifier.ts'
import type { SchemaToValueFn, SchemaType, TypeSystemOutput } from '../types/TypeSystem.ts'
import { Inserted } from '../dsl/Inserted.ts'
import { File } from '../dsl/File.ts'
import { JsonFile } from '../dsl/JsonFile.ts'
import invariant from 'tiny-invariant'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { OperationSource, ModelSource, Preview, PreviewModule } from '../types/Preview.ts'
import { match } from 'ts-pattern'
import type { GeneratorConfig } from '../types/GeneratorType.ts'
import { toGeneratorSettings } from '../run/toGeneratorSettings.ts'
type ConstructorArgs = {
  oasDocument: OasDocument
  settings: ClientSettings | undefined
  logger: log.Logger
  stackTrail: StackTrail
  captureCurrentResult: (result: ResultType) => void
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
}

export type PickArgs = {
  name: string
  exportPath: string
}

export type RegisterJsonArgs = {
  destinationPath: string
  json: Record<string, unknown>
}

export type ApplyPackageImportsArgs = {
  destinationPath: string
  exportPath: string
}

export type BaseRegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, Identifier[]>
  definitions?: (Definition | undefined)[]
}

export type RegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, Identifier[]>
  definitions?: (Definition | undefined)[]
  destinationPath: string
}

export type CreateAndRegisterDefinition<Schema extends SchemaType> = {
  schema: Schema
  identifier: Identifier
  destinationPath: string
  schemaToValueFn: SchemaToValueFn
  rootRef: RefName
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

export type InsertOperationOptions<T extends GenerationType> = {
  generation?: T
  destinationPath?: string
}

export type InsertModelOptions<T extends GenerationType> = {
  generation?: T
  destinationPath?: string
}

export type InsertReturn<
  V extends GeneratedValue,
  T extends GenerationType,
  EnrichmentType
> = Inserted<V, T, EnrichmentType>

type RunOperationGeneratorArgs<EnrichmentType = undefined> = {
  oasDocument: OasDocument
  generatorConfig: OperationConfig<EnrichmentType>
}

type RunModelGeneratorArgs<EnrichmentType = undefined> = {
  oasDocument: OasDocument
  generatorConfig: ModelConfig<EnrichmentType>
}

type ToOperationSettingsArgs<V, EnrichmentType = undefined> = {
  operation: OasOperation
  insertable: OperationInsertable<V, EnrichmentType>
}

type BuildModelSettingsArgs<V, EnrichmentType = undefined> = {
  refName: RefName
  insertable: ModelInsertable<V, EnrichmentType>
}

type GenerateResult = {
  files: Map<string, File | JsonFile>
  previews: Record<string, Record<string, Preview>>
}

type ToSettingsArgs = {
  defaultSelected: boolean
}

type AddPreviewArgs = {
  previewModule: PreviewModule
  operation: OasOperation
}

export class GenerateContext {
  #files: Map<string, File | JsonFile>
  #previews: Record<string, Record<string, Preview>>
  oasDocument: OasDocument
  settings: ClientSettings | undefined
  logger: log.Logger
  captureCurrentResult: (result: ResultType) => void
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  stackTrail: StackTrail
  modelDepth: Record<string, number>

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

  toSettings({ defaultSelected }: ToSettingsArgs): ClientGeneratorSettings[] {
    const generators: GeneratorConfig[] = Object.values(this.toGeneratorConfigMap())

    const generatorSettings = Sentry.startSpan({ name: 'toSettings' }, () =>
      generators.map(generatorConfig => {
        return this.trace(generatorConfig.id, () => {
          return match(generatorConfig)
            .returnType<ClientGeneratorSettings>()
            .with({ type: 'operation' }, operationGenerator => {
              const generatorSettings = toGeneratorSettings({
                settings: this.settings,
                generatorId: operationGenerator.id,
                generatorType: operationGenerator.type
              })

              const operationsSettings = this.oasDocument.operations
                .filter(operation => {
                  return operationGenerator.isSupported({
                    context: this,
                    operation
                  })
                })
                .reduce(
                  (acc, { path, method }) => {
                    const currentSettings = generatorSettings?.operations?.[path]?.[method]

                    acc[path] = {
                      ...acc[path],
                      [method]: currentSettings ?? {
                        selected: defaultSelected,
                        enrichments: undefined
                      }
                    }

                    return acc
                  },
                  {} as Record<string, Partial<Record<Method, EnrichedSetting>>>
                )

              return {
                ...generatorSettings,
                id: operationGenerator.id,
                operations: operationsSettings
              }
            })
            .with({ type: 'model' }, modelGenerator => {
              const generatorSettings = toGeneratorSettings({
                settings: this.settings,
                generatorId: modelGenerator.id,
                generatorType: modelGenerator.type
              })

              const modelsSettings = (
                this.oasDocument.components?.toSchemasRefNames() ?? []
              ).reduce(
                (acc, refName) => {
                  const currentSettings = generatorSettings?.models?.[refName]

                  acc[refName] = currentSettings ?? {
                    selected: defaultSelected,
                    enrichments: undefined
                  }

                  return acc
                },
                {} as Record<string, EnrichedSetting>
              )

              return {
                ...generatorSettings,
                id: modelGenerator.id,
                models: modelsSettings
              }
            })
            .exhaustive()
        })
      })
    )

    return generatorSettings
  }

  #runOperationGenerator<EnrichmentType = undefined>({
    oasDocument,
    generatorConfig
  }: RunOperationGeneratorArgs<EnrichmentType>) {
    oasDocument.operations.reduce((acc, operation) => {
      return this.trace([operation.path, operation.method], () => {
        if (
          typeof generatorConfig?.isSupported === 'function' &&
          !generatorConfig.isSupported({ operation, context: this })
        ) {
          this.captureCurrentResult('notSupported')
          return acc
        }

        const { selected } = this.toOperationSettings({
          generatorId: generatorConfig.id,
          path: operation.path,
          method: operation.method
        })

        if (!selected) {
          this.captureCurrentResult('notSelected')
          return acc
        }

        try {
          this.#addPreview(
            toOperationSource({ operation, generatorId: generatorConfig.id }),
            generatorConfig.toPreviewModule?.({ context: this, operation })
          )

          const result = generatorConfig.transform({ context: this, operation, acc })

          this.captureCurrentResult('success')

          return result
        } catch (error) {
          this.logger.error(error)

          this.captureCurrentResult('error')
        }
      })
    }, undefined)
  }

  #runModelGenerator<EnrichmentType = undefined>({
    oasDocument,
    generatorConfig
  }: RunModelGeneratorArgs<EnrichmentType>) {
    const refNames = oasDocument.components?.toSchemasRefNames() ?? []

    return refNames.reduce((acc, refName) => {
      return this.trace(refName, () => {
        const { selected } = this.toModelSettings({
          generatorId: generatorConfig.id,
          refName
        })

        if (!selected) {
          this.captureCurrentResult('notSelected')
          return acc
        }

        try {
          this.#addPreview(
            toModelSource({ refName, generatorId: generatorConfig.id }),
            generatorConfig.toPreviewModule?.({ context: this, refName })
          )

          const result = generatorConfig.transform({ context: this, refName, acc })

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

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.stackTrail, token, fn)
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
   * @param rootRef - If the definition identifier is a ref, provide it here. It can be
   * used to support circular references depending on generator implementation.
   * @returns The created definition or cached definition if it already exists.
   */
  createAndRegisterDefinition<Schema extends SchemaType>({
    schema,
    identifier,
    destinationPath,
    schemaToValueFn,
    rootRef
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
      rootRef,
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

  /** @experimental */
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
    { generation, destinationPath }: InsertOperationOptions<T> = {}
  ): Inserted<V, T, EnrichmentType> {
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

  insertModel<V extends GeneratedValue, T extends GenerationType, EnrichmentType>(
    insertable: ModelInsertable<V, EnrichmentType>,
    refName: RefName,
    { generation, destinationPath }: InsertModelOptions<T> = {}
  ): Inserted<V, T, EnrichmentType> {
    const { settings, definition } = new ModelDriver({
      context: this,
      insertable,
      refName,
      generation,
      destinationPath,
      rootRef: refName
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

    if (!generatorSettings) {
      return { selected: true }
    }

    const operationSettings =
      'operations' in generatorSettings ? generatorSettings.operations[path]?.[method] : undefined

    return operationSettings ?? { selected: false }
  }

  toModelSettings({ generatorId, refName }: ToModelSettingsArgs): EnrichedSetting {
    const generatorSettings = this.settings?.generators?.find(({ id }) => id === generatorId)

    if (!generatorSettings) {
      return { selected: true }
    }

    const modelSettings =
      'models' in generatorSettings ? generatorSettings.models[refName] : undefined

    return modelSettings ?? { selected: false }
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

export const toModelSource = ({ refName, generatorId }: ToModelSourceArgs): ModelSource => ({
  type: 'model',
  generatorId,
  refName
})
