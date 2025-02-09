import type { ModelInsertable } from './types.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { normalize } from 'jsr:@std/path@1.0.6'
import { Definition } from '../Definition.ts'
import type { Identifier } from '../Identifier.ts'
import type { GeneratedDefinition, GenerationType } from '../../types/GeneratedValue.ts'
import type { GeneratedValue } from '../../types/GeneratedValue.ts'
import type { RefName } from '../../types/RefName.ts'
import { toModelGeneratorKey } from '../../types/GeneratorKeys.ts'

type CreateModelArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
  context: GenerateContext
  insertable: ModelInsertable<V, EnrichmentType>
  refName: RefName
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

export class ModelDriver<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
  context: GenerateContext
  insertable: ModelInsertable<V, EnrichmentType>
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V, T>
  constructor({
    context,
    insertable,
    refName,
    generation,
    destinationPath
  }: CreateModelArgs<V, T, EnrichmentType>) {
    this.context = context
    this.insertable = insertable
    this.refName = refName
    this.destinationPath = destinationPath

    this.settings = this.context.toModelContentSettings({ refName, insertable })

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
      refName: this.refName,
      context: this.context,
      settings: this.settings,
      destinationPath: this.settings.exportPath
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

    const currentKey = toModelGeneratorKey({
      generatorId: this.insertable.id,
      refName: this.refName
    })

    if (currentKey !== definition.generatorKey) {
      throw new Error(
        `Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`
      )
    }

    return definition.value instanceof this.insertable
  }
}
