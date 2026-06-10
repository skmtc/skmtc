import type { ManifestContent } from '@skmtc/core/Manifest'
import type { Sidecar, GenerationMapEntry } from '@skmtc/core/Anchors'

/**
 * Host-side wire shape posted back by `@skmtc/worker` after a generate
 * run. `parseIssues` now lives inside the manifest (see
 * `core/types/Manifest.ts`) — agents and CLI consumers read them from
 * `manifest.parseIssues` rather than as a sibling field.
 *
 * `sidecars` + `generationMap` are present only when the request
 * payload's `attribution.postPass` was set. Caller writes them to
 * disk via `writeSidecars` (`@skmtc/core/Anchors`).
 */
export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
  sidecars?: Record<string, Sidecar>
  generationMap?: GenerationMapEntry[]
}
