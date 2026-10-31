/**
 * One structured log line that `toArtifacts` returns in `logs`.
 *
 * A line logged while a subject is generated carries the subject's stack
 * trail in `trail`. That is the same string `manifest.results` is keyed
 * by, so an `ERROR` line joins to the `'error'` leaf of its subject.
 *
 * @module LogLine
 */

import * as v from 'valibot'
import { serializedError, type SerializedError } from '@/types/SerializedError.ts'

/** The level of a {@link LogLine}. A `CRITICAL` record is recorded as `'ERROR'`. */
export type LogLineLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

/** Valibot schema for {@link LogLineLevel}. */
export const logLineLevel = v.picklist(['DEBUG', 'INFO', 'WARN', 'ERROR'])

const _logLineLevelDriftCheck: v.GenericSchema<LogLineLevel> = logLineLevel
void _logLineLevelDriftCheck

export type LogLine = {
  /** Position of the line in the run, from 0. */
  seq: number
  level: LogLineLevel
  /** The subject's stack trail. Absent outside a subject (parse, render). */
  trail?: string
  message: string
  /** The first `Error` the line was logged with. */
  error?: SerializedError
  /** When the line was logged, in milliseconds since the epoch. */
  time: number
}

/** Valibot schema for {@link LogLine}. */
export const logLine = v.object({
  seq: v.number(),
  level: logLineLevel,
  trail: v.optional(v.string()),
  message: v.string(),
  error: v.optional(serializedError),
  time: v.number()
})

const _logLineDriftCheck: v.GenericSchema<LogLine> = logLine
void _logLineDriftCheck
