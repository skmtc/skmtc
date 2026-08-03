/**
 * SLOT(library): the emitted library, in one place.
 *
 * LIB_MODULE is the module specifier written into emitted import
 * headers; LIB is the imported symbol every snippet's render body
 * composes with — effect's `Schema` module namespace, emitted as
 * `import { Schema } from 'effect'`.
 */
export const LIB_MODULE = 'effect'
export const LIB = 'Schema'
