import type { GqlOperationInsertable } from './types.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import { Definition } from '@/dsl/Definition.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedDefinition } from '../../GeneratedValue.ts'
import type { GeneratedValue } from '../../GeneratedValue.ts'
import type { GenerateContextType } from '../../../context/generateTypes.ts'
import type { GeneratorKey } from '@/dsl/GeneratorKeys.ts'

type CreateGqlOperationArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  context: GenerateContextType
  insertable: GqlOperationInsertable<V, EnrichmentType>
  operation: GqlOperation
  destinationPath?: string
  noExport?: boolean
}

type ApplyArgs = {
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: Identifier
  exportPath: string
}

/**
 * Builds the operation generator key for a GraphQL operation.
 *
 * Mirrors the OAS `toOperationGeneratorKey` shape (`generatorId|path|method`)
 * but uses `rootKind` and `fieldName` in the path/method positions —
 * `${generatorId}|${rootKind}|${fieldName}`.
 */
const toGqlOperationGeneratorKey = ({
  generatorId,
  operation
}: {
  generatorId: string
  operation: GqlOperation
}): GeneratorKey => {
  return `${generatorId}|${operation.rootKind}|${operation.fieldName}` as unknown as GeneratorKey
}

/**
 * Driver class for generating operation-based artifacts from GraphQL operations.
 *
 * The `GqlOperationDriver` manages the transformation of `GqlOperation` objects
 * into code artifacts, handling export-path resolution, identifier generation,
 * and definition caching. It serves as the GraphQL counterpart to the OAS
 * `OperationDriver` in the SKMTC pipeline.
 *
 * @template V - Type of generated values produced by this driver
 * @template EnrichmentType - Type of enrichments that can be applied
 */
export class GqlOperationDriver<V extends GeneratedValue, EnrichmentType = undefined> {
  /** The generation context providing access to GraphQL objects and utilities */
  context: GenerateContextType
  /** The insertable object that provides generation configuration */
  insertable: GqlOperationInsertable<V, EnrichmentType>
  /** The GraphQL operation object being processed */
  operation: GqlOperation
  /** Content settings for customizing generation behavior */
  settings: ContentSettings<EnrichmentType>
  /** Optional custom destination path for generated files */
  destinationPath?: string
  /** The generated definition containing the transformed operation */
  definition: GeneratedDefinition<V>
  /** Whether to exclude this operation from exports */
  noExport?: boolean

  /**
   * Creates a new GqlOperationDriver instance.
   */
  constructor({
    context,
    insertable,
    operation,
    destinationPath,
    noExport
  }: CreateGqlOperationArgs<V, EnrichmentType>) {
    this.context = context
    this.insertable = insertable
    this.operation = operation
    this.destinationPath = destinationPath
    this.noExport = noExport
    // GenerateContextType.toOperationContentSettings is statically typed
    // against OasOperation. The runtime path treats both protocols uniformly,
    // so cast at the call site until the context gains a Gql overload.
    this.settings = this.context.toOperationContentSettings({
      operation: operation as unknown as OasOperation,
      insertable: insertable as never
    })

    this.definition = this.apply({ destinationPath })
  }

  /**
   * Applies generation configuration to create the operation definition.
   *
   * Handles the core generation logic for operations, including identifier
   * resolution, export-path management, and import registration for cross-file
   * dependencies.
   */
  private apply({ destinationPath }: ApplyArgs = {}): GeneratedDefinition<V> {
    const { identifier, exportPath } = this.settings

    const definition = this.getDefinition({ identifier, exportPath })

    if (destinationPath && normalize(exportPath) !== normalize(destinationPath)) {
      this.context.register({
        imports: { [exportPath]: [identifier.name] },
        destinationPath
      })
    }

    return definition
  }

  /**
   * Retrieves or creates a definition for the operation.
   *
   * Checks the definition cache first to avoid duplicate generation, then
   * creates a new definition if none exists.
   */
  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): Definition<V> {
    const cachedDefinition = this.context.findDefinition({
      name: identifier.name,
      exportPath
    })

    if (this.affirmDefinition<V>(cachedDefinition, exportPath)) {
      return cachedDefinition
    }

    const value = new this.insertable({
      context: this.context,
      operation: this.operation,
      settings: this.settings
    })

    const definition = new Definition({
      context: this.context,
      value,
      identifier,
      noExport: this.noExport
    })

    this.context.register({
      definitions: [definition],
      destinationPath: exportPath
    })

    return definition
  }

  /**
   * Type guard to verify a definition matches the expected generated value type.
   */
  private affirmDefinition<V extends GeneratedValue>(
    definition: Definition | undefined,
    exportPath: string
  ): definition is Definition<V> {
    if (!definition) {
      return false
    }

    const currentKey = toGqlOperationGeneratorKey({
      generatorId: this.insertable.id,
      operation: this.operation
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    return definition.value instanceof this.insertable
  }
}
