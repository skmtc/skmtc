import { ContextInputProps, KeyPath } from '@/utils/types/modelConfig'
import { ElToggleItem, InputGroup, Label, Toggle } from '@reapit/elements'
import { FieldValues, useFormContext } from 'react-hook-form'

export const Switch = <Model extends FieldValues, Key extends KeyPath<Model>>({
  fieldName,
  fieldConfig,
}: ContextInputProps<Model, Key>) => {
  const { label } = fieldConfig

  const { register, formState } = useFormContext<Model>()

  const { errors } = formState

  return (
    <InputGroup errorMessage={errors[fieldName]?.message as string}>
      <Toggle {...register(fieldName)} id={fieldName}>
        <ElToggleItem>On</ElToggleItem>
        <ElToggleItem>Off</ElToggleItem>
      </Toggle>
      <Label>{label}</Label>
    </InputGroup>
  )
}
