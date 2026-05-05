/**
 * Public sub-export for the SKMTC GraphQL parser.
 *
 * Consumers that want SDL → GqlDocument parsing import from this module
 * (typically as `@skmtc/core/parsers/graphql`) so that the `graphql` npm
 * dependency only enters their type-check graph when explicitly needed.
 *
 * Operation generators that only consume `GqlDocument` / `GqlOperation`
 * etc. should import those types from the main `@skmtc/core` module to
 * avoid the dependency.
 */
export * from './toGqlDocument.ts'
export * from './unwrapType.ts'
export * from './toScalarType.ts'
export * from './toEnumType.ts'
export * from './toFieldSchema.ts'
export * from './toObjectType.ts'
export * from './toInputType.ts'
export * from './toUnionType.ts'
export * from './toInterfaceUnion.ts'
export * from './toRootField.ts'
