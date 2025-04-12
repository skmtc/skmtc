import { match } from 'ts-pattern'
import type {
  ClientSettings,
  OperationsGeneratorSettings,
  ModelsGeneratorSettings
} from '../types/Settings.ts'

type ToSettingArgs<Type extends 'operation' | 'model'> = {
  settings: ClientSettings | undefined
  generatorId: string
  generatorType: Type
}

type GeneratorSettingsReturn<Type extends 'operation' | 'model'> = Type extends 'operation'
  ? OperationsGeneratorSettings
  : ModelsGeneratorSettings

export const toGeneratorSettings = <Type extends 'operation' | 'model'>({
  settings,
  generatorId,
  generatorType
}: ToSettingArgs<Type>): GeneratorSettingsReturn<Type> | undefined => {
  const generatorSettings = settings?.generators.find(({ id }) => id === generatorId)

  return match(generatorType satisfies 'operation' | 'model')
    .with('operation', () => {
      return generatorSettings && 'operations' in generatorSettings
        ? (generatorSettings as GeneratorSettingsReturn<Type>)
        : undefined
    })
    .with('model', () => {
      return generatorSettings && 'models' in generatorSettings
        ? (generatorSettings as GeneratorSettingsReturn<Type>)
        : undefined
    })
    .exhaustive()
}
