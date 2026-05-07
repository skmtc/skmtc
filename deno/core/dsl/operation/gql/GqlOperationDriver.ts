import type { GqlOperationProjection } from './types.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import { Definition } from '@/dsl/Definition.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedDefinition } from '@/dsl/GeneratedValue.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { toGqlOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'

type CreateGqlOperationArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  context: GenerateContextType
  projection: GqlOperationProjection<V, EnrichmentType>
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
 * Driver for the GraphQL operation insertion lifecycle.
 *
 * GraphQL counterpart to {@link OasOperationDriver}: resolves the
 * projection's identifier and export path, looks up an existing
 * `Definition` in the target file, instantiates the projection when no
 * cache hit exists, registers the new definition, and stitches an import
 * into `destinationPath` if it differs from the projection's `exportPath`.
 */
export class GqlOperationDriver<V extends GeneratedValue, EnrichmentType = undefined> {
  context: GenerateContextType
  projection: GqlOperationProjection<V, EnrichmentType>
  operation: GqlOperation
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V>
  noExport?: boolean

  constructor({
    context,
    projection,
    operation,
    destinationPath,
    noExport
  }: CreateGqlOperationArgs<V, EnrichmentType>) {
    this.context = context
    this.projection = projection
    this.operation = operation
    this.destinationPath = destinationPath
    this.noExport = noExport
    this.settings = this.context.toOperationContentSettings({
      operation,
      projection
    })

    this.definition = this.apply({ destinationPath })
  }

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

  private getDefinition({ identifier, exportPath }: GetDefinitionArgs): Definition<V> {
    const cachedDefinition = this.context.findDefinition({
      name: identifier.name,
      exportPath
    })

    if (this.affirmDefinition<V>(cachedDefinition, exportPath)) {
      return cachedDefinition
    }

    const value = new this.projection({
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

  private affirmDefinition<V extends GeneratedValue>(
    definition: Definition | undefined,
    exportPath: string
  ): definition is Definition<V> {
    if (!definition) {
      return false
    }

    const currentKey = toGqlOperationGeneratorKey({
      generatorId: this.projection.id,
      operation: this.operation
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    return definition.value instanceof this.projection
  }
}
