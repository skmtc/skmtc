import type { FieldValues, FieldPath } from 'react-hook-form'

export type KeyPath<T extends FieldValues> = Extract<FieldPath<T>, keyof T>
