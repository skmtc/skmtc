import { KeyPath } from '@/components/forms/types'
import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FieldValues, useFormContext } from 'react-hook-form'

type NumberFieldProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  fieldName: Key
  label?: string
  placeholder?: string
}

export const NumberField = <Model extends FieldValues, Key extends KeyPath<Model>>({
  label,
  fieldName,
  placeholder
}: NumberFieldProps<Model, Key>) => {
  const { control } = useFormContext<Model>()

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field: { value, onChange, ...field } }) => (
        <FormItem className="px-px">
          {typeof label === 'string' && (
            <FormLabel htmlFor={fieldName} className="text-right">
              {label}
            </FormLabel>
          )}
          <FormControl>
            <Input
              type="number"
              value={isNaN(value) || value === 0 ? '' : value.toString()}
              onChange={event => {
                const value = event.target.valueAsNumber

                onChange(isNaN(value) ? 0 : value)
              }}
              placeholder={placeholder}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
