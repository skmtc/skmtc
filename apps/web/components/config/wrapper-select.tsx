import type { OpenAPIV3 } from 'openapi-types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/standard-select'
import { standardInput } from '@/lib/classes'
import { InputWrapper } from '@/components/config/types'

const wrappers: InputWrapper[] = [
  'InputWrap',
  'InputWrapSmall',
  'InputWrapMed',
  'InputWrapFull',
  'InputWrapHalf'
]

type InputSelectProps = {
  value: string | undefined
  setValue: (value: string) => void
}

export const InputSelect = ({ value, setValue }: InputSelectProps) => {
  const formatterOptions = wrappers.map(wrapper => ({
    value: wrapper,
    label: wrapper
  }))

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className={standardInput}>
        <SelectValue placeholder="Format" />
      </SelectTrigger>
      <SelectContent>
        {formatterOptions.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
