import { OpenAPIV3 } from 'openapi-types'

export type InputWrapper =
  | 'InputWrap'
  | 'InputWrapSmall'
  | 'InputWrapMed'
  | 'InputWrapFull'
  | 'InputWrapHalf'

export type FormFieldItem = {
  accessorPath: string[]
  input: 'TextInput' | 'DateInput' | 'ToggleInput'
  label: string
  placeholder?: string
  wrapper?: InputWrapper
}

export type FormSectionItem = {
  title: string
  fields: FormFieldItem[]
}

export type ColumnConfigItem = {
  accessorPath: string[]
  formatter: string
  label: string
}
export type SchemaItem = {
  schema: OpenAPIV3.SchemaObject
  name: string
  type: 'list-item' | 'form-item'
}
export type SelectedSchemaType = {
  schema: OpenAPIV3.SchemaObject
  name: string
}
