import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/standard-select'
import { InputWrapper } from '@/components/config/types'
import { inputClasses } from '@/lib/classes'
import { inputEdgeClasses } from '@/lib/classes'
import { cn } from '@/lib/utils'

const wrappers: InputWrapper[] = [
  'InputWrap',
  'InputWrapSmall',
  'InputWrapMed',
  'InputWrapFull',
  'InputWrapHalf'
]

type WrapperSelectProps = {
  value: string | undefined
  setValue: (value: string) => void
}

export const WrapperSelect = ({ value, setValue }: WrapperSelectProps) => {
  const formatterOptions = wrappers.map(wrapper => ({
    value: wrapper,
    label: wrapper
  }))

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger className={cn(inputClasses, inputEdgeClasses)}>
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
