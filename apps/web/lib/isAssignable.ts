import type { OpenAPIV3 } from 'openapi-types'
import { isRef, resolveRef } from '@/lib/schemaFns'
import { match } from 'ts-pattern'

type IsAssignableArgs = {
  from: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  to: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
  path: string[]
  fullSchema: OpenAPIV3.Document
  options?: {
    logMismatch?: boolean
  }
}

export const isAssignable = ({ from, to, fullSchema, path }: IsAssignableArgs): MatchResult => {
  if (!to) {
    return { matched: false, path, reason: 'Destination type is not provided' }
  }

  if (isRef(from)) {
    from = resolveRef(from, fullSchema)
  }

  if (isRef(to)) {
    to = resolveRef(to, fullSchema)
  }

  return match(to)
    .returnType<MatchResult>()
    .with({ type: 'string' }, matched => {
      return isStringAssignable({ from, to: matched, fullSchema, path })
    })
    .with({ type: 'number' }, matched => {
      return isNumberAssignable({ from, to: matched, fullSchema, path })
    })
    .with({ type: 'integer' }, matched => {
      return isIntegerAssignable({ from, to: matched, fullSchema, path })
    })
    .with({ type: 'boolean' }, matched => {
      return isBooleanAssignable({ from, to: matched, fullSchema, path })
    })
    .with({ type: 'array' }, matched => {
      return isArrayAssignable({ from, to: matched, fullSchema, path })
    })
    .with({ type: 'object' }, matched => {
      return isObjectAssignable({ from, to: matched, fullSchema, path })
    })
    .otherwise(() => {
      return { matched: false, path, reason: `Destination type '${to.type}' is not supported` }
    })
}

type MatchResult =
  | {
      matched: true
      reason: null
      path: null
    }
  | {
      matched: false
      reason: string
      path: string[]
    }

type IsStringAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isStringAssignable = ({ from, path }: IsStringAssignableArgs): MatchResult => {
  return match(from.type === 'string')
    .with(true, matched => ({ matched, path: null, reason: null }))
    .with(false, matched => ({
      matched,
      path,
      reason: `Type '${from.type}' is not assignable to 'string'`
    }))
    .exhaustive()
}

type IsNumberAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isNumberAssignable = ({ from, to, path }: IsNumberAssignableArgs): MatchResult => {
  return match(from.type === 'number' || from.type === 'integer')
    .with(true, matched => ({ matched, path: null, reason: null }))
    .with(false, matched => ({
      matched,
      path,
      reason: `Type '${from.type}' is not assignable to '${to.type}'`
    }))
    .exhaustive()
}

type IsIntegerAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isIntegerAssignable = ({ from, path }: IsIntegerAssignableArgs): MatchResult => {
  return match(from.type === 'integer')
    .with(true, matched => ({ matched, path: null, reason: null }))
    .with(false, matched => ({
      matched,
      path,
      reason: `Type '${from.type}' is not assignable to 'integer'`
    }))
    .exhaustive()
}

type IsBooleanAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isBooleanAssignable = ({ from, path }: IsBooleanAssignableArgs): MatchResult => {
  return match(from.type === 'boolean')
    .with(true, matched => ({ matched, path: null, reason: null }))
    .with(false, matched => ({
      matched,
      path,
      reason: `Type '${from.type}' is not assignable to 'boolean'`
    }))
    .exhaustive()
}

type IsArrayAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.ArraySchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isArrayAssignable = ({
  from,
  to,
  path,
  fullSchema
}: IsArrayAssignableArgs): MatchResult => {
  if (from.type !== 'array') {
    return { matched: false, path, reason: `Type '${from.type}' is not assignable to 'array'` }
  }

  return isAssignable({ from: from.items, to: to.items, path: [...path, 'items'], fullSchema })
}

type IsObjectAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isObjectAssignable = ({
  from,
  to,
  path,
  fullSchema
}: IsObjectAssignableArgs): MatchResult => {
  if (from.type !== 'object') {
    return { matched: false, path, reason: `Type '${from.type}' is not assignable to 'object'` }
  }

  const toPropertyEntries = Object.entries(to?.properties || {})

  for (const [key, value] of toPropertyEntries) {
    if (typeof from?.properties?.[key] === 'undefined') {
      return { matched: false, path, reason: `Property '${key}' is not defined in source` }
    }

    if (to.required?.includes(key) === true && !from.required?.includes(key)) {
      return {
        matched: false,
        path,
        reason: `Property '${key}' is required in destination but is optional in source`
      }
    }

    const keyResult = isAssignable({
      from: from.properties[key],
      to: value,
      path: [...path, key],
      fullSchema
    })

    if (keyResult.matched === false) {
      return keyResult
    }
  }

  return { matched: true, path: null, reason: null }
}
