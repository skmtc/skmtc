/**
 * @fileoverview The trailing argument of an insert call: placement and
 * export settings plus the peer's caller options.
 *
 * @module InsertOptions
 */

import { readProjectionOptions } from '@/types/ProjectionOptions.ts'
import type { ProjectionOptionsArg, ProjectionOptionsRest } from '@/types/ProjectionOptions.ts'

/** Settings a caller may set when inserting a peer into the caller's own file. */
export type PeerInsertSettings = {
  /** Whether to exclude the peer's definition from exports */
  noExport?: boolean
  /**
   * Target variant of the peer projection. Omit for `'main'`; pass only
   * when the peer declares this variant — the Driver throws on mismatch.
   */
  variant?: string
}

/** {@link PeerInsertSettings} plus the file to import the peer into. */
export type InsertSettings = PeerInsertSettings & {
  /** Custom destination path for the peer's definition */
  destinationPath?: string
}

/**
 * {@link PeerInsertSettings} plus the peer's caller options. `NoInfer`
 * keeps `ProjectionOptions` inferred from the projection alone.
 */
export type PeerInsertOptions<ProjectionOptions = undefined> = PeerInsertSettings &
  ProjectionOptionsArg<NoInfer<ProjectionOptions>>

/** {@link InsertSettings} plus the peer's caller options. */
export type InsertOptions<ProjectionOptions = undefined> = InsertSettings &
  ProjectionOptionsArg<NoInfer<ProjectionOptions>>

/**
 * The keys a caller may set on a peer insertion, picked off the trailing
 * argument so nothing else on it reaches the engine.
 */
export const toPeerInsertOptions = <ProjectionOptions>(
  rest: ProjectionOptionsRest<PeerInsertOptions<ProjectionOptions>, ProjectionOptions>
): PeerInsertSettings & { options: ProjectionOptions } => {
  const [args] = rest

  return {
    noExport: args?.noExport,
    variant: args?.variant,
    options: readProjectionOptions<ProjectionOptions>(args)
  }
}

/** {@link toPeerInsertOptions} plus the destination path, for `context.insertModel`. */
export const toInsertOptions = <ProjectionOptions>(
  rest: ProjectionOptionsRest<InsertOptions<ProjectionOptions>, ProjectionOptions>
): InsertSettings & { options: ProjectionOptions } => {
  const [args] = rest

  return {
    noExport: args?.noExport,
    destinationPath: args?.destinationPath,
    variant: args?.variant,
    options: readProjectionOptions<ProjectionOptions>(args)
  }
}
