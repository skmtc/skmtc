// The freshness + invariant header that rides on EVERY trace/explain
// answer. The verify-first stance made structural: an agent cannot read a
// provenance answer without being told which run it describes and whether
// that run is in the fail-open "success with no output" state (friction
// theme 1 — the checks here are the manifest-computable subset).

import type { ProjectProvenance } from '@/lib/provenance/store.ts'

export type Freshness = {
  /** ISO end time of the run that wrote the manifest; null = never generated. */
  generatedAt: string | null
  manifestPresent: boolean
  /** Whether any provenance spans were decoded (`.maps` present + aligned). */
  mapsPresent: boolean
  /** Artifacts whose spans could not be re-anchored (reshaped after generate). */
  staleFileCount: number
  invariants: {
    /** Manifest files recorded with zero characters. */
    emptyFileCount: number
    /** `success` leaves in the manifest results tree. */
    successCount: number
    /** THE theme-1 impossible state: empty output beside success results. */
    emptyOutputWithSuccess: boolean
  }
}

export const toFreshness = (prov: ProjectProvenance): Freshness => {
  const { hasManifest, zeroCharacterFiles, successCount } = prov.diagnosticsInput
  return {
    generatedAt: prov.generatedAtIso ?? null,
    manifestPresent: hasManifest,
    mapsPresent: prov.entryCount > 0,
    staleFileCount: prov.staleFiles.size,
    invariants: {
      emptyFileCount: zeroCharacterFiles.length,
      successCount,
      emptyOutputWithSuccess: zeroCharacterFiles.length > 0 && successCount > 0
    }
  }
}
