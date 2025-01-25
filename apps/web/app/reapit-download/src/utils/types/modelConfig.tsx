import { type FieldValues, type FieldPath, PathValue } from 'react-hook-form'
import { ChangeEvent, ComponentType, ReactNode } from 'react'
import { IconNames } from '@reapit/elements'

export type KeyPath<T extends FieldValues> = Extract<FieldPath<T>, keyof T>

export type ConfigValue<Model extends FieldValues, FormPath extends KeyPath<Model>> = {
  key: FormPath
  label: string
  defaultValue: Model[FormPath] | null
  Input: ComponentType<ContextInputProps<Model, FormPath>>
  format: (value: Model[FormPath]) => ReactNode
  icon?: IconNames
  placeholder?: string
  width?: number
  minWidth?: number
  transform?: (event: ChangeEvent) => PathValue<Model, FormPath>
}

export type ModelConfig<Model extends FieldValues> = {
  [Property in KeyPath<Model>]: ConfigValue<Model, Property>
}

export type ContextInputProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  fieldName: Key
  fieldConfig: ModelConfig<Model>[Key]
}

export type Option = {
  name: string
  id: string
}
