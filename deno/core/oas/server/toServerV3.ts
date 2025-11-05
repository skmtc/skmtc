import type { ParseContextType } from '@/context/parseTypes.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { OasServer } from './Server.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import { toOptionalServerVariablesV3 } from '../serverVariable/toServerVariableV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
type ToServersV3Args = {
  servers: OpenAPIV3.ServerObject[]
  stackTrail: StackTrail
  context: ParseContextType
}

export const toServersV3 = ({ servers, stackTrail, context }: ToServersV3Args): OasServer[] => {
  return servers.map((server, index) => {
    return stackTrail.trace(server.url ?? index, st =>
      toServerV3({ server, stackTrail: st, context })
    )
  })
}

type ToOptionalServersV3Args = {
  servers: OpenAPIV3.ServerObject[] | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toOptionalServersV3 = ({
  servers,
  stackTrail,
  context
}: ToOptionalServersV3Args): OasServer[] | undefined => {
  if (!servers) {
    return undefined
  }

  return toServersV3({ servers, stackTrail, context })
}

type ToServerV3Args = {
  server: OpenAPIV3.ServerObject
  stackTrail: StackTrail
  context: ParseContextType
}

export const toServerV3 = ({ server, stackTrail, context }: ToServerV3Args): OasServer => {
  const { description, url, variables, ...skipped } = server

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: server,
    context,
    stackTrail,
    parentType: 'server'
  })

  return new OasServer({
    description,
    url,
    variables: toOptionalServerVariablesV3({ serverVariables: variables, stackTrail, context }),
    extensionFields
  })
}
