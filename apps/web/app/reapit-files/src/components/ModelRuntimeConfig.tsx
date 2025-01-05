import { ColumnDef } from '@tanstack/react-table'
import { type FieldValues, type FieldPath, PathValue } from 'react-hook-form'
import { ChangeEvent, ComponentType, ReactNode } from 'react'
import Box from '@mui/joy/Box'
import { IconNames } from '@reapit/elements'

export type ColumnsMap<Model> = {
  [Property in keyof Model]: ColumnDef<Model, Model[Property]>
}

type NotUndefined<T> = T extends undefined ? never : T

export type ValueOf<T> = T[keyof T]

export type ColumnsList<Model> = NotUndefined<ValueOf<ColumnsMap<Model>>>[]

type UiConfig<Model extends FieldValues> = {
  [Property in KeyPath<Model>]: boolean
}

export type FixedUiConfig<Model extends FieldValues> = RestoreOptional<UiConfig<Model>, Model>

export const fieldsConfig = <Model extends FieldValues>(formFields: FixedUiConfig<Model>) => {
  return Object.keys(formFields)
    .filter((fieldName): fieldName is keyof FixedUiConfig<Model> => fieldName in formFields)
    .filter((fieldName) => formFields[fieldName])
}

export type KeysOf<T> = (keyof T)[]

export type OptionalKeys<T> = keyof {
  [P in keyof T as T[P] extends Required<T>[P] ? never : P]: T[P]
}

export type RequiredKeys<T> = keyof {
  [P in keyof T as T[P] extends Required<T>[P] ? P : never]: T[P]
}

export type RestoreOptional<T, KeySource> = Partial<Pick<T, OptionalKeys<KeySource>>> & Pick<T, RequiredKeys<KeySource>>

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

type FieldParentProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  fieldName: Key
  fieldConfig: ModelConfig<Model>[Key]
}

export const FieldParent = <Model extends FieldValues, Key extends KeyPath<Model>>({
  fieldName,
  fieldConfig,
}: FieldParentProps<Model, Key>) => {
  const { Input } = fieldConfig
  return <Input fieldName={fieldName} fieldConfig={fieldConfig} />
}

export type ContextInputProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  fieldName: Key
  fieldConfig: ModelConfig<Model>[Key]
}

export const NotImplemented = () => <Box>Not implemented</Box>

export type Option = {
  name: string
  id: string
}
