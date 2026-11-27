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

/** The fields of the parse issue a {@link LogLine} reports. */
export type LogLineIssue = {
  /**
   * The issue's type. A string, not the closed list of types: a reader on
   * an older core must still read a line with a type added since.
   */
  type: string
  level: 'error' | 'warning' | 'debug'
  /** The issue's `location`, as `manifest.parseIssues` has it. */
  location: string
  /** The object around the issue, as JSON. */
  parent?: string
}

/** Valibot schema for {@link LogLineIssue}. */
export const logLineIssue = v.object({
  type: v.string(),
  level: v.picklist(['error', 'warning', 'debug']),
  location: v.string(),
  parent: v.optional(v.string())
})

const _logLineIssueDriftCheck: v.GenericSchema<LogLineIssue> = logLineIssue
void _logLineIssueDriftCheck

/**
 * A log argument that gives its line an `issue` field. Parse logs one with
 * each issue it records.
 */
export class LogLineIssueArg {
  issue: LogLineIssue

  constructor(issue: LogLineIssue) {
    this.issue = issue
  }
}

export type LogLine = {
  /** Position of the line in the run, from 0. */
  seq: number
  level: LogLineLevel
  /**
   * The subject's stack trail, or the generator's on the line a generator
   * logs after it ran. Absent outside a generator (parse, render).
   */
  trail?: string
  message: string
  /** The first `Error` the line was logged with. */
  error?: SerializedError
  /** The parse issue the line reports. */
  issue?: LogLineIssue
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
  issue: v.optional(logLineIssue),
  time: v.number()
})

const _logLineDriftCheck: v.GenericSchema<LogLine> = logLine
void _logLineDriftCheck
