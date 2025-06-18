import { StringField } from '@/components/inputs/string-field'
import { SelectField } from '@/components/inputs/select-field'
import { DateField } from '@/components/inputs/date-field'
import { NumberField } from '@/components/inputs/number-field'
import { MapField } from '@/components/inputs/map-field'

//  https://stackoverflow.com/questions/56373756/typescript-constrain-generic-to-string-literal-type-for-use-in-computed-object-p
type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never

type ActualString<T> = T extends string ? (string extends T ? T : never) : never

export const stringFieldMapping = <T>(arg: ActualString<T>) => {
  return StringField
}

export const enumsFieldMapping = <T>(arg: StringLiteral<T>) => {
  return SelectField
}

export const numberFieldMapping = (arg: number) => {
  return NumberField
}

export const dateFieldMapping = (arg: Date) => {
  return DateField
}

type Coordinates = {
  lat: number
  lng: number
}

export const mapFieldMapping = (arg: Coordinates) => {
  return MapField
}
