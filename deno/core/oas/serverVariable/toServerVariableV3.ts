import type { ParseContextType } from '@/context/parseTypes.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { OasServerVariable } from './ServerVariable.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

export type ToServerVariablesV3Args = {
  serverVariables: Record<string, OpenAPIV3.ServerVariableObject>
  stackTrail: StackTrail
  context: ParseContextType
}

export const toServerVariablesV3 = ({
  serverVariables,
  stackTrail,
  context
}: ToServerVariablesV3Args): Record<string, OasServerVariable> => {
  return Object.fromEntries(
    Object.entries(serverVariables).map(([key, serverVariable]) => [
      key,
      toServerVariableV3({ serverVariable, stackTrail, context })
    ])
  )
}

export type ToOptionalServerVariablesV3Args = {
  serverVariables: Record<string, OpenAPIV3.ServerVariableObject> | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toOptionalServerVariablesV3 = ({
  serverVariables,
  stackTrail,
  context
}: ToOptionalServerVariablesV3Args): Record<string, OasServerVariable> | undefined => {
  if (!serverVariables) {
    return undefined
  }

  return toServerVariablesV3({ serverVariables, stackTrail, context })
}

export type ToServerVariableV3Args = {
  serverVariable: OpenAPIV3.ServerVariableObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toServerVariableV3 = ({
  serverVariable,
  stackTrail,
  context
}: ToServerVariableV3Args): OasServerVariable => {
  const { description, default: defaultValue, enum: enums, ...skipped } = serverVariable

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: serverVariable,
    context,
    stackTrail,
    parentType: 'serverVariable'
  })

  return new OasServerVariable({
    description,
    default: defaultValue,
    enums,
    extensionFields
  })
}
