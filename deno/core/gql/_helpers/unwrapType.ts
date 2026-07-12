import { type GraphQLType, type GraphQLNamedType, isNonNullType, isListType } from 'graphql'

/**
 * Result of unwrapping a possibly list/non-null wrapped GraphQL type.
 *
 * GraphQL field types are stacked from named-type inwards:
 * - `T`     → outerNullable=true
 * - `T!`    → outerNullable=false
 * - `[T]`   → list=true, outerNullable=true,  itemNullable=true
 * - `[T!]`  → list=true, outerNullable=true,  itemNullable=false
 * - `[T]!`  → list=true, outerNullable=false, itemNullable=true
 * - `[T!]!` → list=true, outerNullable=false, itemNullable=false
 *
 * The four-cell list-nullability matrix is captured precisely. Nested
 * lists (`[[T!]!]!`) are not currently representable as a single
 * `OasArray` of items — the unwrapper detects them and signals via
 * `nestedList=true` so the caller can fall back to a more permissive
 * representation.
 */
export type UnwrappedType = {
  /** The innermost named GraphQL type (object, scalar, enum, etc.). */
  named: GraphQLNamedType
  /** True if the type is wrapped in a list (one level). */
  isList: boolean
  /** Whether the (single) list itself can be null. */
  outerNullable: boolean
  /** Whether items inside the list can be null. Meaningless if `isList=false`. */
  itemNullable: boolean
  /** Set if more than one list wrapper was encountered. */
  nestedList: boolean
}

/**
 * Strips list and non-null wrappers from a GraphQL type, returning the
 * innermost named type and a structural description of its modifiers.
 *
 * GraphQL wrapping types are always shaped `(NonNull? List? NonNull? Named)`,
 * peeled outermost first. This walks the chain and records the bookkeeping.
 */
export const unwrapType = (type: GraphQLType): UnwrappedType => {
  let outerNullable = true
  let isList = false
  let itemNullable = true
  let nestedList = false
  let current: GraphQLType = type

  // Outer non-null
  if (isNonNullType(current)) {
    outerNullable = false
    current = current.ofType
  }

  // List
  if (isListType(current)) {
    isList = true
    current = current.ofType

    // Item non-null
    if (isNonNullType(current)) {
      itemNullable = false
      current = current.ofType
    }

    // Detect nested lists
    if (isListType(current) || (isNonNullType(current) && isListType(current.ofType))) {
      nestedList = true
      // Walk to the eventual named type
      let walker: GraphQLType = current
      while (isListType(walker) || isNonNullType(walker)) {
        walker = walker.ofType
      }
      current = walker
    }
  }

  return {
    named: current as GraphQLNamedType,
    isList,
    outerNullable,
    itemNullable,
    nestedList
  }
}
