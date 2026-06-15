/**
 * Apply OpenAPI Overlay (1.0.0) documents to an OpenAPI description.
 *
 * A Deno port of {@link https://github.com/lornajane/openapi-overlays-js | openapi-overlays-js}
 * by Lorna Mitchell (Apache-2.0).
 *
 * @example
 * ```ts
 * import { applyOverlay } from '@skmtc/openapi-overlays'
 *
 * const updated = applyOverlay(spec, {
 *   overlay: '1.0.0',
 *   actions: [
 *     { target: "$.paths['/pets'].get", update: { 'x-overlaid': true } },
 *   ],
 * })
 * ```
 *
 * @example Reading from disk
 * ```ts
 * import { overlayFiles } from '@skmtc/openapi-overlays'
 *
 * const yaml = await overlayFiles('openapi.yaml', 'overlay.yaml')
 * console.log(yaml)
 * ```
 *
 * @module
 */

export { applyOverlay, overlayFiles, stringifyDocument } from './overlay.ts'
export type {
  JsonObject,
  JsonPrimitive,
  JsonValue,
  Overlay,
  OverlayAction,
  OverlayFormat,
} from './overlay.ts'
