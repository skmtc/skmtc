// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import { isIdentifierName } from 'npm:@babel/helper-validator-identifier@7.27.1'
import { camelCase } from '@skmtc/core'
import { sanitizeIdentifier } from '@/src/sanitizeIdentifier.ts'

/**
 * Names the variable that holds an operation parameter in generated code.
 *
 * A name that is not an identifier is camel-cased, and a reserved word gains
 * the suffix {@link sanitizeIdentifier} gives it. Two names can give one
 * variable (`a-b` and `aB`).
 *
 * @example
 * ```typescript
 * toParameterVariable('user_id')         // 'user_id'
 * toParameterVariable('enterprise-team') // 'enterpriseTeam'
 * toParameterVariable('export')          // 'exportValue'
 * toParameterVariable('2fa')             // '_2fa'
 * ```
 */
export const toParameterVariable = (name: string): string => {
  return sanitizeIdentifier(isIdentifierName(name) ? name : camelCase(name))
}
