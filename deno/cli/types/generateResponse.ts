import type { ManifestContent } from '@skmtc/core/Manifest'

export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}
