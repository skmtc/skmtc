import { ContextInputProps, KeyPath } from '@/utils/types/modelConfig'
import { InputError, InputGroup } from '@reapit/elements'
import { FieldValues, useFormContext } from 'react-hook-form'

export const TextInput = <Model extends FieldValues, Key extends KeyPath<Model>>({
  fieldName,
  fieldConfig
}: ContextInputProps<Model, Key>) => {
  const { icon, label, placeholder } = fieldConfig

  const { register, formState } = useFormContext<Model>()

  const { errors } = formState

  const errorMessage = errors[fieldName]?.message

  return (
    <>
      <InputGroup
        label={label}
        type="text"
        placeholder={placeholder}
        {...register(fieldName)}
        hasError={Boolean(errorMessage)}
      />
      {errorMessage && <InputError message={errorMessage as string} />}
    </>
  )
}
