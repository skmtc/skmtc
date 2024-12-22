import type {
  GeneratedDefinition,
  GeneratedValue,
  GenerationType
} from '../types/GeneratedValue.ts'
import type { ContentSettings } from './ContentSettings.ts'
import type { Identifier } from './Identifier.ts'

type ConstructorArgs<V extends GeneratedValue, T extends GenerationType> = {
  settings: ContentSettings
  definition: GeneratedDefinition<V, T>
}

export class Inserted<V extends GeneratedValue, T extends GenerationType> {
  settings: ContentSettings
  definition: GeneratedDefinition<V, T>
  constructor({ settings, definition }: ConstructorArgs<V, T>) {
    this.settings = settings
    this.definition = definition
  }

  toName(): string {
    return this.settings.identifier.name
  }

  toIdentifier(): Identifier {
    return this.settings.identifier
  }

  toExportPath(): string {
    return this.settings.exportPath
  }

  toValue(): T extends 'force' ? V : V | undefined {
    return this.definition?.value as T extends 'force' ? V : V | undefined
  }
}
