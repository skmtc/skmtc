// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import { isIdentifierName } from 'npm:@babel/helper-validator-identifier@7.22.20'

export const handleKey = (key: string): string => {
  return isIdentifierName(key) ? key : `'${key}'`
}

export const handlePropertyName = (name: string, parent: string): string => {
  return isIdentifierName(name) ? `${parent}.${name}` : `${parent}['${name}']`
}
