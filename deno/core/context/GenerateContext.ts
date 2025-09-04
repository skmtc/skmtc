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
  rootRef?: RefName
  noExport?: boolean
}

export type DefineAndRegisterArgs<V extends GeneratedValue> = {
  identifier: Identifier
  value: V
  destinationPath: string
  noExport?: boolean
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
  noExport?: boolean
  generation?: T
  destinationPath?: string
}

export type InsertNormalisedModelArgs<Schema extends OasSchema | OasRef<'schema'> | OasVoid> = {
  fallbackName: string
  schema: Schema
  destinationPath: string
}

export type InsertNormalisedModelOptions = {
  noExport?: boolean
}

export type InsertNormalisedModelReturn<
  V extends GeneratedValue,
  Schema extends OasSchema | OasRef<'schema'> | OasVoid
> =
  Schema extends OasRef<'schema'>
    ? Definition<V>
    : Definition<TypeSystemOutput<SchemaToNonRef<Schema>['type']>>

export type InsertModelOptions<T extends GenerationType> = {
  noExport?: boolean
  generation?: T
  destinationPath?: string
}

export type InsertReturn<
  V extends GeneratedValue,
  T extends GenerationType,
  EnrichmentType
> = Inserted<V, T, EnrichmentType>

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
  mappings: Record<string, Record<string, Mapping>>
}

export class GenerateContext {
  #files: Map<string, File | JsonFile>
  #previews: Record<string, Record<string, Preview>>
  #mappings: Record<string, Record<string, Mapping>>
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
