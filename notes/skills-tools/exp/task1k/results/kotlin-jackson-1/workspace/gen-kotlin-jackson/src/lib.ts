/**
 * SLOT(library): the emitted library, in one place.
 *
 * Jackson's databind annotations live in one package and this generator
 * emits exactly one of them, so both the package and the symbol are
 * constants rather than a `LIB` object composed into every render body.
 * `KtAnnotation` registers the import itself when handed `packageName`.
 */
export const JACKSON_ANNOTATION_PACKAGE = 'com.fasterxml.jackson.annotation'
export const JSON_PROPERTY = 'JsonProperty'

/**
 * SLOT(export-path) input: the Kotlin package every model lands in.
 *
 * FIXED for this generator — no enrichment configuration is provided at
 * runtime, so the path policy is hardcoded. The export path's directory
 * segments ARE the package (`@/com/example/models/Order.generated.kt` →
 * `package com.example.models`), so this constant is the single source
 * of both. All models sharing one package is what makes `KtFile`'s
 * same-package suppression drop every cross-model import.
 */
export const BASE_PACKAGE = 'com.example.models'
