import { ContextInputProps, KeyPath } from '@/utils/types/modelConfig'
import { InputError, InputGroup, Label, Select } from '@reapit/elements'
import { FieldValues, useFormContext } from 'react-hook-form'

export const TITLE_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Miss', 'Mx', 'Dr', 'Prof']

export const TitleInput = <Model extends FieldValues, Key extends KeyPath<Model>>({
  fieldName,
  fieldConfig,
}: ContextInputProps<Model, Key>) => {
  const { label } = fieldConfig

  const { register, formState } = useFormContext<Model>()

  const { errors } = formState

  const errorMessage = errors[fieldName]?.message

  return (
    <InputGroup>
      <Select {...register(fieldName)}>
        <option key="default-option" value="">
          None selected
        </option>
        {TITLE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <Label>{label}</Label>
      {errorMessage && <InputError message={errorMessage as string} />}
    </InputGroup>
  )
}
