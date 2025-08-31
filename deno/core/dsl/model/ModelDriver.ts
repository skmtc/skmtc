import type { ModelInsertable } from './types.ts'
import type { GenerateContext } from '../../context/GenerateContext.ts'
import type { ContentSettings } from '../ContentSettings.ts'
import { normalize } from '@std/path/normalize'
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
  rootRef?: RefName
  noExport?: boolean
}
type ApplyArgs<T extends GenerationType> = {
  generation?: T
  destinationPath?: string
}

type GetDefinitionArgs = {
  identifier: Identifier
  exportPath: string
  noExport?: boolean
}

export class ModelDriver<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
  context: GenerateContext
  insertable: ModelInsertable<V, EnrichmentType>
  refName: RefName
  settings: ContentSettings<EnrichmentType>
  destinationPath?: string
  definition: GeneratedDefinition<V, T>
  rootRef?: RefName
  noExport?: boolean
  constructor({
    context,
    insertable,
    refName,
    generation,
    destinationPath,
    rootRef,
    noExport
  }: CreateModelArgs<V, T, EnrichmentType>) {
    this.context = context
    this.insertable = insertable
    this.refName = refName
    this.destinationPath = destinationPath
    this.rootRef = rootRef
    this.noExport = noExport

    this.context.modelDepth[`${insertable.id}:${refName}`] = 0

    this.settings = this.context.toModelContentSettings({ refName, insertable })
    this.definition = this.apply({ generation, destinationPath })

    this.context.modelDepth[`${insertable.id}:${refName}`] = 0
  }

  private apply<T extends GenerationType>({
    generation,
    destinationPath
  }: ApplyArgs<T> = {}): GeneratedDefinition<V, T> {
    const { identifier, exportPath } = this.settings

    // Everything is selected (for now)
    // if (/*!selected && */ generation !== 'force') {
    //   return undefined as GeneratedDefinition<V, T>
    // }

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

    // const [previous, current] = this.context.stackTrail.slice(-2).stackTrail

    // if (
    //   previous === this.insertable.id &&
    //   current === this.refName &&
    //   this.refName === this.rootRef
    // ) {
    //   this.context.modelDepth++
    // }

    const value = new this.insertable({
      refName: this.refName,
      context: this.context,
      settings: this.settings,
      destinationPath: this.settings.exportPath,
      rootRef: this.rootRef
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
