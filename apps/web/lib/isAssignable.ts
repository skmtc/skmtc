import type { OpenAPIV3 } from 'openapi-types'
import { isRef, resolveRef } from '@/lib/schemaFns'
import { match } from 'ts-pattern'

type IsAssignableArgs = {
  from: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  to: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isAssignable = ({ from, to, fullSchema, path }: IsAssignableArgs): boolean => {
  if (!to) {
    return false
  }

  if (isRef(from)) {
    from = resolveRef(from, fullSchema)
  }

  if (isRef(to)) {
    to = resolveRef(to, fullSchema)
  }

  return match(from)
    .with({ type: 'string' }, matched => {
      return isStringAssignable({ from: matched, to, fullSchema, path })
    })
    .with({ type: 'number' }, matched => {
      return isNumberAssignable({ from: matched, to, fullSchema, path })
    })
    .with({ type: 'integer' }, matched => {
      return isIntegerAssignable({ from: matched, to, fullSchema, path })
    })
    .with({ type: 'boolean' }, matched => {
      return isBooleanAssignable({ from: matched, to, fullSchema, path })
    })
    .with({ type: 'array' }, matched => {
      return isArrayAssignable({ from: matched, to, fullSchema, path })
    })
    .with({ type: 'object' }, matched => {
      return isObjectAssignable({ from: matched, to, fullSchema, path })
    })
    .otherwise(() => {
      return false
    })
}

type IsStringAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isStringAssignable = ({ to }: IsStringAssignableArgs) => {
  return to.type === 'string'
}

type IsNumberAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isNumberAssignable = ({ to }: IsNumberAssignableArgs) => {
  return to.type === 'number'
}

type IsIntegerAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isIntegerAssignable = ({ to }: IsIntegerAssignableArgs) => {
  return to.type === 'integer' || to.type === 'number'
}

type IsBooleanAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isBooleanAssignable = ({ to }: IsBooleanAssignableArgs) => {
  return to.type === 'boolean'
}

type IsArrayAssignableArgs = {
  from: OpenAPIV3.ArraySchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isArrayAssignable = ({ from, to, path, fullSchema }: IsArrayAssignableArgs) => {
  return (
    to.type === 'array' &&
    isAssignable({ from: from.items, to: to.items, path: [...path, 'items'], fullSchema })
  )
}

type IsObjectAssignableArgs = {
  from: OpenAPIV3.SchemaObject
  to: OpenAPIV3.SchemaObject
  path: string[]
  fullSchema: OpenAPIV3.Document
}

export const isObjectAssignable = ({ from, to, path, fullSchema }: IsObjectAssignableArgs) => {
  if (to.type !== 'object') {
    return false
  }

  const toPropertyEntries = Object.entries(to?.properties || {})

  for (const [key, value] of toPropertyEntries) {
    if (typeof from?.properties?.[key] === 'undefined') {
      return false
    }

    if (to.required?.includes(key) === true && !from.required?.includes(key)) {
      return false
    }

    if (
      !isAssignable({ from: from.properties[key], to: value, path: [...path, key], fullSchema })
    ) {
      return false
    }
  }

  return true
}
