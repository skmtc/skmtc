import type { ManifestContent } from '@skmtc/core/Manifest'

/**
 * Host-side wire shape posted back by `@skmtc/worker` after a generate
 * run. `parseIssues` now lives inside the manifest (see
 * `core/types/Manifest.ts`) — agents and CLI consumers read them from
 * `manifest.parseIssues` rather than as a sibling field.
 */
export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}
