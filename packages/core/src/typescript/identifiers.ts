
import { isIdentifierName } from '@babel/helper-validator-identifier'

export const handleKey = (key: string): string => {
  return isIdentifierName(key) ? key : `'${key}'`
}

export const handlePropertyName = (name: string, parent: string): string => {
  return isIdentifierName(name) ? `${parent}.${name}` : `${parent}['${name}']`
}
