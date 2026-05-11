import {
  isObjectType,
  isInputObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isScalarType,
  isIntrospectionType,
  type GraphQLNamedType
} from 'graphql'
import type { GqlDocumentFields } from '@/gql/document/GqlDocument.ts'
import type { GqlRootTypes } from '@/gql/rootType/GqlRootTypes.ts'
import { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import { toObjectType } from '@/gql/object/toObjectType.ts'
import { toInputType } from '@/gql/input/toInputType.ts'
import { toEnumType } from '@/gql/enum/toEnumType.ts'
import { toUnionType } from '@/gql/union/toUnionType.ts'
import { toInterfaceUnion } from '@/gql/interface/toInterfaceUnion.ts'
import { toScalarType } from '@/gql/scalar/toScalarType.ts'
import { toRootField } from '@/gql/operation/toRootField.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { ParseContext, GqlParseOptions } from '@/context/ParseContext.ts'
import type { StackTrail } from '@/context/StackTrail.ts'

/**
 * Built-in GraphQL directives that are part of every schema and not
 * worth reporting as "skipped" — they always exist whether the user
 * authored them or not.
 */
const BUILTIN_DIRECTIVES = new Set(['skip', 'include', 'deprecated', 'specifiedBy', 'oneOf'])

export type ParseGqlDocumentArgs = {
  options: GqlParseOptions
  context: ParseContext
  /**
   * Root stack trail to descend from. Each named type and root field
   * is parsed inside `stackTrail.trace(<name>, ...)` so consumer
   * stack trails (recorded via `context.registerRef`) line up with
   * the addresses `removeErroredItems` uses to prune.
   */
  stackTrail: StackTrail
}

/**
 * Wraps a per-type parse in try/catch so a single bad type doesn't
 * abort the whole parse run. On catch:
 *  - registers the error against the type's name so
 *    `removeErroredItems` can prune dependents at the end
 *  - logs an `INVALID_TYPE_DEFINITION` issue at the type's location
 *
 * Mirrors the OAS pattern where a failing component's error is
 * captured at its `components.<kind>.<name>` location and dependents
 * are kicked out later.
 */
const tryParseType = <T>(
  typeName: string,
  typeStack: StackTrail,
  context: ParseContext,
  fn: () => T
): T | undefined => {
  try {
    return fn()
  } catch (error) {
    context.registerRefError(error, typeName)
    context.log({
      level: 'error',
      type: 'INVALID_TYPE_DEFINITION',
      location: typeStack.toString(),
      message:
        error instanceof Error
          ? `Type '${typeName}' failed to parse: ${error.message}`
          : `Type '${typeName}' failed to parse: ${String(error)}`
    })
    return undefined
  }
}

/**
 * Internal implementation behind `ParseContext.parse()` (GQL branch)
 * and the convenience free function `toGqlDocument`.
 *
 * Returns the `GqlDocumentFields` ready to be assigned via
 * `gqlDocument.fields = ...` onto the empty `GqlDocument` that
 * `ParseContext` issued at construction time. This indirection exists
 * so refs constructed during the walk hold a reference to the same
 * `GqlDocument` instance that will eventually carry the fields — see
 * the forward-declared-refs notes on `OasDocument` / `GqlDocument`.
 *
 * Reads `context.schema` and `context.registry` directly — both are
 * populated by the `ParseContext` constructor, so this function does
 * no setup.
 */
export const parseGqlDocument = ({
  options,
  context,
  stackTrail
}: ParseGqlDocumentArgs): { fields: GqlDocumentFields } => {
  const { interfaceUnionSuffix = 'Union', emitInterfaceUnions = true } = options
  const { schema, registry } = context

  // Schema-level: warn about user-defined directive *definitions*.
  // Applied directives on individual nodes are recorded by the
  // per-type/per-field walks via `recordAppliedDirectives`.
  for (const directive of schema.getDirectives()) {
    if (BUILTIN_DIRECTIVES.has(directive.name)) continue
    context.log({
      level: 'warning',
      location: `@${directive.name}`,
      message: `Custom directive '@${directive.name}' is not represented in generated output`,
      type: 'DROPPED_DIRECTIVE'
    })
  }

  // Pass 1: walk all named types and register them.
  const typeMap = schema.getTypeMap()
  for (const [name, type] of Object.entries(typeMap)) {
    if (isIntrospectionType(type)) continue
    // Skip the root operation types if they're encountered here; we treat
    // their fields as operations, not as object schema entries that need
    // their own registry slot. Generators that want a "Query" type can
    // look at the rootTypes pointers.
    if (
      type === schema.getQueryType() ||
      type === schema.getMutationType() ||
      type === schema.getSubscriptionType()
    ) {
      continue
    }

    stackTrail.trace(name, typeStack => {
      addNamedType({
        name,
        type,
        typeStack,
        context,
        emitInterfaceUnions,
        interfaceUnionSuffix
      })
    })
  }

  // Pass 2: build operations from each root type's fields.
  const operations: GqlOperation[] = []
  const rootTypes: GqlRootTypes = {}

  const collectRootOps = (
    rootType: GraphQLNamedType & { getFields: () => Record<string, unknown> } | null | undefined,
    rootKind: 'query' | 'mutation' | 'subscription',
    assignRootType: (name: RefName) => void
  ) => {
    if (!rootType) return
    assignRootType(rootType.name as RefName)
    stackTrail.trace(rootType.name, rootStack => {
      for (const field of Object.values(
        (rootType as unknown as { getFields: () => Record<string, unknown> }).getFields()
      )) {
        const typedField = field as { name: string }
        rootStack.trace(typedField.name, fieldStack => {
          try {
            operations.push(
              toRootField({
                rootKind,
                // deno-lint-ignore no-explicit-any
                field: typedField as any,
                context,
                stackTrail: fieldStack
              })
            )
          } catch (error) {
            // A root field's parse threw — record under the
            // qualified name (`Query.getUser`) so any cross-references
            // to it (rare, but possible) can be pruned by
            // `removeErroredItems`. Issue location uses the field's
            // stack trail.
            const operationName = `${rootType.name}.${typedField.name}`
            context.registerRefError(error, operationName)
            context.log({
              level: 'error',
              type: 'INVALID_TYPE_DEFINITION',
              location: fieldStack.toString(),
              message:
                error instanceof Error
                  ? `Root field '${operationName}' failed to parse: ${error.message}`
                  : `Root field '${operationName}' failed to parse: ${String(error)}`
            })
          }
        })
      }
    })
  }

  collectRootOps(schema.getQueryType(), 'query', n => {
    rootTypes.query = n
  })
  collectRootOps(schema.getMutationType(), 'mutation', n => {
    rootTypes.mutation = n
  })
  collectRootOps(schema.getSubscriptionType(), 'subscription', n => {
    rootTypes.subscription = n
  })

  return {
    fields: {
      registry,
      operations,
      rootTypes
    }
  }
}

type AddNamedTypeArgs = {
  name: string
  type: GraphQLNamedType
  typeStack: StackTrail
  context: ParseContext
  emitInterfaceUnions: boolean
  interfaceUnionSuffix: string
}

/**
 * Dispatch each named type to its protocol-specific parser, wrapping
 * the call in `tryParseType` so a single bad type doesn't abort the
 * whole run.
 */
const addNamedType = ({
  name,
  type,
  typeStack,
  context,
  emitInterfaceUnions,
  interfaceUnionSuffix
}: AddNamedTypeArgs): void => {
  const { registry } = context

  const tryAdd = (
    refName: RefName,
    builder: () => OasSchema | OasRef<'schema'>
  ): void => {
    const value = tryParseType(name, typeStack, context, builder)
    if (value !== undefined) {
      registry.add(refName, value)
    }
  }

  if (isObjectType(type)) {
    tryAdd(name as RefName, () =>
      toObjectType({ objectType: type, context, stackTrail: typeStack })
    )
  } else if (isInputObjectType(type)) {
    tryAdd(name as RefName, () =>
      toInputType({ inputType: type, context, stackTrail: typeStack })
    )
  } else if (isInterfaceType(type)) {
    // Base interface as an object (so generators can emit a TS interface).
    tryAdd(name as RefName, () =>
      toObjectType({ objectType: type, context, stackTrail: typeStack })
    )
    if (emitInterfaceUnions) {
      const unionName = `${name}${interfaceUnionSuffix}` as RefName
      tryAdd(unionName, () =>
        toInterfaceUnion({ interfaceType: type, context, stackTrail: typeStack })
      )
    }
  } else if (isUnionType(type)) {
    tryAdd(name as RefName, () =>
      toUnionType({ unionType: type, context, stackTrail: typeStack })
    )
  } else if (isEnumType(type)) {
    tryAdd(name as RefName, () =>
      toEnumType({ enumType: type, context, stackTrail: typeStack })
    )
  } else if (isScalarType(type)) {
    // Built-in scalars (Int, String, …) are inlined at usage sites and
    // don't need registry entries; only register custom scalars so
    // downstream generators can iterate them if needed.
    const isBuiltin =
      type.name === 'Int' ||
      type.name === 'Float' ||
      type.name === 'String' ||
      type.name === 'Boolean' ||
      type.name === 'ID'
    if (!isBuiltin) {
      tryAdd(name as RefName, () =>
        toScalarType({ scalar: type, nullable: false, context, stackTrail: typeStack })
      )
    }
  }
}
