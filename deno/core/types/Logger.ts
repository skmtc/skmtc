import type * as log from '@std/log'

/**
 * Logger type alias for SKMTC operations.
 * 
 * Re-exports the @std/log Logger type to maintain public API compatibility
 * while providing type-safe logging throughout the SKMTC pipeline.
 */
export type Logger = log.Logger