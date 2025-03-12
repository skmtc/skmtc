import { FieldValues, useFormContext } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { KeyPath } from '@/components/forms/types'
import { useGetApiGenerators } from '@/services/useGetApiGenerators.generated'

type GeneratorsListFieldProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  fieldName: Key
  label?: string
  placeholder?: string
}

export const GeneratorsListField = <Model extends FieldValues, Key extends KeyPath<Model>>({
  label,
  fieldName
}: GeneratorsListFieldProps<Model, Key>) => {
  const { control } = useFormContext<Model>()

  const { data: generators } = useGetApiGenerators()

  return (
    <FormField
      control={control}
      name={fieldName}
      render={() => (
        <FormItem>
          <div className="mb-4">
            <FormLabel className="text-base">{label}</FormLabel>
          </div>
          {generators?.map(generator => (
            <FormField
              key={generator.name}
              control={control}
              name={fieldName}
              render={({ field }) => {
                const value: string[] = field.value ?? []
                return (
                  <FormItem
                    key={generator.name}
                    className="flex flex-row items-start space-x-3 space-y-0"
                  >
                    <FormControl>
                      <Checkbox
                        checked={value?.includes(generator.name)}
                        onCheckedChange={checked => {
                          return checked
                            ? field.onChange([...value, generator.name])
                            : field.onChange(value?.filter(value => value !== generator.name))
                        }}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal">{generator.name}</FormLabel>
                  </FormItem>
                )
              }}
            />
          ))}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
