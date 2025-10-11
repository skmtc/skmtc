// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import { isIdentifierName, isReservedWord } from 'npm:@babel/helper-validator-identifier@7.27.1'
import { List } from '../typescript/List.ts'
import { camelCase } from './strings.ts'

export const sanitizePropertyName = (propertyName: string) => {
  if (isReservedWord(propertyName, true)) {
    return sanitizeReservedWord(propertyName)
  }

  if (!isIdentifierName(propertyName)) {
    return List.toKeyValue(propertyName, camelCase(propertyName))
  }

  return propertyName
}

const sanitizeReservedWord = (propertyName: string) => {
  const destarred = propertyName.replace(' *', 'Star')
  return `${destarred}Value`
}
