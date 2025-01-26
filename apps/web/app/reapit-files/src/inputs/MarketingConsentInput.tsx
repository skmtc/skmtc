import { ContextInputProps, KeyPath } from '@/utils/types/modelConfig'
import { InputError, InputGroup, Label, Select } from '@reapit/elements'
import { FieldValues, useFormContext } from 'react-hook-form'

export const MARKETING_OPTIONS = [
  { value: 'grant', name: 'Granted' },
  { value: 'deny', name: 'Denied' },
  { value: 'notAsked', name: 'Not Asked' }
]

export const MarketingConsentInput = <Model extends FieldValues, Key extends KeyPath<Model>>({
  fieldName,
  fieldConfig
}: ContextInputProps<Model, Key>) => {
  const { label } = fieldConfig

  const { register, formState } = useFormContext<Model>()

  const { errors } = formState

  const errorMessage = errors[fieldName]?.message

  return (
    <>
      <InputGroup>
        <Select {...register(fieldName)}>
          <option key="default-option" value="">
            None selected
          </option>
          {MARKETING_OPTIONS.map(({ name, value }) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </Select>
        <Label>{label}</Label>
      </InputGroup>
      {errorMessage && <InputError message={errorMessage as string} />}
    </>
  )
}
