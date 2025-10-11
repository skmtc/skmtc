// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import { isIdentifierName } from 'npm:@babel/helper-validator-identifier@7.27.1'
import { List } from '../typescript/List.ts'
import { camelCase } from './strings.ts'
import { protectedKeywords } from './protectedKeywords.ts'

export const sanitizePropertyName = (propertyName: string) => {
  const sanitizedKeyword = protectedKeywords[propertyName]

  if (sanitizedKeyword) {
    return sanitizedKeyword
  }

  if (!isIdentifierName(propertyName)) {
    return List.toKeyValue(`'${propertyName}'`, camelCase(propertyName))
  }

  return propertyName
}
