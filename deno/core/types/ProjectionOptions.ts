/**
 * @fileoverview Caller options for projections.
 *
 * Options are typed data the CALLING generator passes when it inserts a
 * peer: `context.insertModel(Peer, refName, { options })`. Enrichments are
 * the user's per-subject configuration and a variant selects one of them;
 * options belong to the caller.
 *
 * A projection declares its options type on its base factory. The
 * constructor and the identity statics (`toIdentifierName`,
 * `toExportPath`) receive a plain `options` field, the base class stores
 * it as `this.options`, and the Drivers infer the type from the projection
 * class. Core never names a specific options type.
 *
 * Options take part in identity: the engine caches definitions by name and
 * export path, so a projection whose output depends on its options must
 * fold them into `toIdentifierName`. A cache hit whose options differ from
 * the call's throws. Options are held by reference until render, so pass a
 * fresh object per insertion.
 *
 * @module ProjectionOptions
 */

/**
 * The `options` slot on an insert call. Required when the projection
 * declares options, and `undefined`-only when it declares none, so a stray
 * `options` on such a call is a type error. Include `undefined` in the
 * declared type to make the slot optional.
 */
export type ProjectionOptionsArg<ProjectionOptions> = undefined extends ProjectionOptions
  ? { options?: ProjectionOptions }
  : { options: ProjectionOptions }

/**
 * The trailing parameter of an insert call, optional only when the
 * projection's options are. Read it with `toInsertOptions` /
 * `toPeerInsertOptions`, which pick the known keys off it.
 */
export type ProjectionOptionsRest<Args, ProjectionOptions> = undefined extends ProjectionOptions
  ? [args?: Args]
  : [args: Args]

/**
 * Read the caller's options off an insert call inside generic code.
 *
 * While `ProjectionOptions` is a type parameter, a direct `args.options`
 * reads as `ProjectionOptions | undefined`: the compiler cannot see that
 * the key is only absent when `undefined` is already a member. The
 * overload states that once. Pass the type argument explicitly.
 */
export function readProjectionOptions<ProjectionOptions>(
  args: ProjectionOptionsArg<ProjectionOptions> | undefined
): ProjectionOptions
export function readProjectionOptions(args: { options?: unknown } | undefined): unknown {
  return args?.options
}

/** The options a built value carries; `undefined` for a value that stores none. */
export const toValueOptions = (value: object): unknown =>
  'options' in value ? value.options : undefined
