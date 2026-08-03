/**
 * SLOT(library): the emitted library, in one place.
 *
 * LIB_MODULE is the module specifier written into emitted import
 * headers; LIB is the imported symbol every snippet's render body
 * composes with. Change both here, then rewrite the `toString()`
 * bodies (each marked with a SLOT comment) in the snippet classes.
 */
export const LIB_MODULE = 'effect'
export const LIB = 'Schema'
