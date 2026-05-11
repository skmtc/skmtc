import type { OasOperationProjection } from './types.ts'
import type { OasOperation } from '@/oas/operation/Operation.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import { normalize } from '@std/path/normalize'
import { Definition } from '@/dsl/Definition.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { GeneratedDefinition } from '@/dsl/GeneratedValue.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import { toOasOperationGeneratorKey } from '@/dsl/GeneratorKeys.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'

type CreateOperationArgs<V extends GeneratedValue, EnrichmentType = undefined> = {
  context: GenerateContextType
  projection: OasOperationProjection<V, EnrichmentType>
  operation: OasOperation
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
 * Driver for the OAS operation insertion lifecycle.
 *
 * Resolves the projection's identifier and export path, looks up an
 * existing `Definition` in the target file, instantiates the projection
 * (constructing its value) when no cache hit exists, registers the new
 * definition, and stitches an import into `destinationPath` if it differs
 * from the projection's `exportPath`.
 */
export class OasOperationDriver<V extends GeneratedValue, EnrichmentType = undefined> {
  context: GenerateContextType
  projection: OasOperationProjection<V, EnrichmentType>
  operation: OasOperation
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
  }: CreateOperationArgs<V, EnrichmentType>) {
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
      // `Identifier.toImport()` carries the identifier's entity type so
      // type-only identifiers render as `import { type Foo }` under
      // `verbatimModuleSyntax: true`.
      this.context.register({
        imports: { [exportPath]: [identifier.toImport()] },
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

    const currentKey = toOasOperationGeneratorKey({
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
