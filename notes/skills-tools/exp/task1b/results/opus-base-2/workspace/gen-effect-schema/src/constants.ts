/**
 * The module every generated file imports `Schema` from, and the imported
 * binding itself. Named once here so the ~ten snippets that register the
 * import never drift apart.
 */
export const EFFECT_MODULE = 'effect'

/** The namespace binding generated code addresses effect Schema through. */
export const SCHEMA = 'Schema'

/**
 * The annotation a self-recursive model's `export const` carries. Without
 * it TypeScript cannot infer a binding whose initializer references itself
 * (TS7022 / TS7024); `Schema.Schema<any>` breaks the cycle.
 */
export const RECURSIVE_TYPE_NAME = `${SCHEMA}.${SCHEMA}<any>`
