import { ContextInputProps, KeyPath } from '@/components/ModelRuntimeConfig'
import { Icon, Input, InputError, InputGroup, Label } from '@reapit/elements'
import { FieldValues, useFormContext } from 'react-hook-form'

export const StringInput = <Model extends FieldValues, Key extends KeyPath<Model>>({
  fieldName,
  fieldConfig,
}: ContextInputProps<Model, Key>) => {
  const { icon, label, placeholder } = fieldConfig

  const { register, formState } = useFormContext<Model>()

  const { errors } = formState

  const errorMessage = errors[fieldName]?.message

  return (
    <InputGroup hasError={Boolean(errorMessage)}>
      <Input id={fieldName} type="text" placeholder={placeholder} {...register(fieldName)} />
      {icon ? <Icon fontSize="1rem" icon={icon} /> : null}
      <Label htmlFor={fieldName}>{label}</Label>
      {errorMessage && <InputError message={errorMessage as string} />}
    </InputGroup>
  )
}
