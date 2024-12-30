import type { OperationInsertable } from './OperationInsertable.js'
import type { OasOperation } from '../../oas/operation/Operation.js'
import type { ContentSettings } from '../ContentSettings.js'
import { normalize } from '../../deps/jsr.io/@std/path/1.0.6/mod.js'
import { Definition } from '../Definition.js'
import type { Identifier } from '../Identifier.js'
import type { GeneratedDefinition, GenerationType } from '../../types/GeneratedValue.js'
import type { GeneratedValue } from '../../types/GeneratedValue.js'
import { toOperationGeneratorKey } from '../../types/GeneratorKeys.js'
import type { GenerateContext } from '../../context/GenerateContext.js'

type CreateOperationArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
  context: GenerateContext
  insertable: OperationInsertable<V, EnrichmentType>
  operation: OasOperation
  generation?: T
  destinationPath?: string
}

type ApplyArgs<T extends GenerationType> = {
  generation?: T
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: Identifier
  exportPath: string
}

export class OperationDriver<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
  context: GenerateContext
  insertable: OperationInsertable<V, EnrichmentType>
  operation: OasOperation
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V, T>

  constructor({
    context,
    insertable,
    operation,
    generation,
    destinationPath
  }: CreateOperationArgs<V, T, EnrichmentType>) {
    this.context = context
    this.insertable = insertable
    this.operation = operation
    this.destinationPath = destinationPath

    this.settings = this.context.toOperationContentSettings({
      operation,
      insertable
    })

    this.definition = this.apply({ generation, destinationPath })
  }

  private apply<T extends GenerationType>({
    generation,
    destinationPath
  }: ApplyArgs<T> = {}): GeneratedDefinition<V, T> {
    const { identifier, exportPath, selected } = this.settings

    if (!selected && generation !== 'force') {
      return undefined as GeneratedDefinition<V, T>
    }

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

    const value = new this.insertable({
      context: this.context,
      operation: this.operation,
      settings: this.settings
    })

    const definition = new Definition({
      context: this.context,
      value,
      identifier
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

    const currentKey = toOperationGeneratorKey({
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
