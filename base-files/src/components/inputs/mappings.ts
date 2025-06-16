import { StringField } from './string-field'
import { SelectField } from './select-field'

//  https://stackoverflow.com/questions/56373756/typescript-constrain-generic-to-string-literal-type-for-use-in-computed-object-p
type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never

type ActualString<T> = T extends string ? (string extends T ? T : never) : never

// type P = Permutation<1 | 2 | 3>

export type Permutation<U, T = U> = [U] extends [never]
  ? []
  : T extends unknown
    ? [T, ...Permutation<Exclude<U, T>>]
    : never

// type C = UnionCount<'a' | 'b' | 'c'>

export type UnionCount<U> = Permutation<U>['length']

export const stringFieldMapping = <T>(arg: ActualString<T>) => {
  return StringField
}

export const enumsFieldMapping = <T>(arg: StringLiteral<T>) => {
  return SelectField
}

export const dateFieldMapping = (arg: Date) => {
  return StringField
}
