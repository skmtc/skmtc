/**
 * @fileoverview Gen-maps doctor checks. Three diagnostic checks per
 * plan §5.4:
 *
 *   - `anchors-config/<project>` — anchors block well-formed in client.json
 *   - `anchors-coverage/<project>` — every generated file has a sidecar
 *   - `anchors-staleness/<project>` — no sidecar is older than its file
 *
 * Lives separately from `doctor-headless.ts` to keep that file
 * focused. Each function returns a single `Check`; the headless
 * doctor walks projects and calls these in turn.
 */

import { join } from '@std/path/join'
import { existsSync } from '@std/fs/exists'
import * as v from 'valibot'
import { anchorsSettings, type AnchorsSettings } from '@skmtc/core/Settings'
import { expandClientJson } from '@skmtc/core/ClientJsonCompact'
import { manifestContent } from '@skmtc/core/Manifest'
import { Manifest } from '@/lib/manifest.ts'
import type { Check } from '@/lib/doctor-headless.ts'

/**
 * Reads `client.json#settings.anchors` and reports on its shape +
 * opt-in state.
 *
 *  - No client.json or no `anchors` block → `skipped` (not opted in)
 *  - `anchors.enabled: false` → `skipped` (explicit opt-out)
 *  - `anchors.enabled: true` → `ok`
 *  - Malformed `anchors` block → `warning`
 */
export const checkAnchorsConfig = (
  projectName: string,
  projectPath: string
): Check => {
  const clientJsonPath = join(projectPath, '.settings', 'client.json')
  if (!existsSync(clientJsonPath)) {
    return {
      id: `anchors-config/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has no client.json; anchors config check skipped.`
    }
  }
  let parsed: unknown
  try {
    parsed = expandClientJson(JSON.parse(Deno.readTextFileSync(clientJsonPath)))
  } catch {
    return {
      id: `anchors-config/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" client.json is unparseable; anchors check skipped.`
    }
  }
  const anchors: unknown = (parsed as { settings?: { anchors?: unknown } })?.settings?.anchors
  if (anchors === undefined) {
    return {
      id: `anchors-config/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has no anchors config; gen-maps is opt-in via \`settings.anchors.enabled\`.`
    }
  }
  const validated = v.safeParse(anchorsSettings, anchors)
  if (!validated.success) {
    const summary = validated.issues[0]?.message ?? 'schema mismatch'
    return {
      id: `anchors-config/${projectName}`,
      status: 'warning',
      message: `Project "${projectName}" anchors block doesn't match the expected shape (${summary}).`,
      hint:
        `Expected shape: { "enabled": boolean, "out"?: string }. ` +
        `Open ${clientJsonPath} and fix the \`settings.anchors\` block.`
    }
  }
  const cfg = validated.output
  if (!cfg.enabled) {
    return {
      id: `anchors-config/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has anchors disabled (\`enabled: false\`).`
    }
  }
  return {
    id: `anchors-config/${projectName}`,
    status: 'ok',
    message: `Project "${projectName}" has anchors enabled; output dir is \`${cfg.out ?? '.maps'}\`.`,
    data: { enabled: true, out: cfg.out ?? '.maps' }
  }
}

const COVERAGE_THRESHOLD = 0.95

/**
 * Reads `manifest.files` and counts how many have a matching
 * `<filePath>.skm.json` sidecar under `<projectPath>/<anchors.out>/`.
 *
 *  - Anchors not enabled → `skipped`
 *  - No manifest yet → `skipped`
 *  - Coverage ≥ 95% → `ok`
 *  - Coverage < 95% → `warning`
 *  - No files at all → `skipped`
 */
export const checkAnchorsCoverage = (
  projectName: string,
  projectPath: string
): Check => {
  const anchorsCfg = readAnchorsConfig(projectPath)
  if (!anchorsCfg?.enabled) {
    return {
      id: `anchors-coverage/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" anchors disabled; coverage check skipped.`
    }
  }
  const manifestPath = Manifest.toPath(projectName)
  if (!existsSync(manifestPath)) {
    return {
      id: `anchors-coverage/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has no manifest yet — generate first.`
    }
  }
  const manifest = readManifest(manifestPath)
  if (!manifest) {
    return {
      id: `anchors-coverage/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" manifest is unparseable; coverage check skipped.`
    }
  }
  const filePaths = Object.keys(manifest.files)
  if (filePaths.length === 0) {
    return {
      id: `anchors-coverage/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" manifest lists no files; coverage check skipped.`
    }
  }
  const outDir = join(projectPath, anchorsCfg.out ?? '.maps')
  const present = filePaths.filter(p => existsSync(join(outDir, `${p}.skm.json`)))
  const coverage = present.length / filePaths.length
  if (coverage >= COVERAGE_THRESHOLD) {
    return {
      id: `anchors-coverage/${projectName}`,
      status: 'ok',
      message: `Project "${projectName}" sidecar coverage is ${formatPct(coverage)} (${present.length}/${filePaths.length}).`,
      data: { covered: present.length, total: filePaths.length, coverage }
    }
  }
  return {
    id: `anchors-coverage/${projectName}`,
    status: 'warning',
    message: `Project "${projectName}" sidecar coverage is ${formatPct(coverage)} (${present.length}/${filePaths.length}); below the ${formatPct(COVERAGE_THRESHOLD)} threshold.`,
    hint:
      `Re-run \`skmtc generate ${projectName} --anchors\` to refresh. ` +
      `Persistent low coverage suggests generators are emitting files that the ` +
      `post-pass skips (typically JsonFile artifacts) — that's expected and not a real problem.`,
    data: { covered: present.length, total: filePaths.length, coverage }
  }
}

/**
 * Walks every generated file and checks that its corresponding
 * sidecar's mtime is at least as recent as the file's. A stale
 * sidecar means the user edited (or regenerated) the file without
 * refreshing the anchors — the viewer would show wrong byte ranges.
 *
 *  - Anchors not enabled → `skipped`
 *  - No manifest → `skipped`
 *  - All fresh → `ok`
 *  - Any stale → `warning` with the offending file list
 */
export const checkAnchorsStaleness = (
  projectName: string,
  projectPath: string
): Check => {
  const anchorsCfg = readAnchorsConfig(projectPath)
  if (!anchorsCfg?.enabled) {
    return {
      id: `anchors-staleness/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" anchors disabled; staleness check skipped.`
    }
  }
  const manifestPath = Manifest.toPath(projectName)
  if (!existsSync(manifestPath)) {
    return {
      id: `anchors-staleness/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" has no manifest yet — generate first.`
    }
  }
  const manifest = readManifest(manifestPath)
  if (!manifest) {
    return {
      id: `anchors-staleness/${projectName}`,
      status: 'skipped',
      message: `Project "${projectName}" manifest is unparseable; staleness check skipped.`
    }
  }
  const outDir = join(projectPath, anchorsCfg.out ?? '.maps')
  const stale: string[] = []
  for (const [filePath, entry] of Object.entries(manifest.files)) {
    const sidecarPath = join(outDir, `${filePath}.skm.json`)
    if (!existsSync(sidecarPath)) continue // coverage check handles this
    const fileMtime = mtimeOf(entry.destinationPath)
    const sidecarMtime = mtimeOf(sidecarPath)
    if (fileMtime === null || sidecarMtime === null) continue
    if (sidecarMtime < fileMtime) {
      stale.push(filePath)
    }
  }
  if (stale.length === 0) {
    return {
      id: `anchors-staleness/${projectName}`,
      status: 'ok',
      message: `Project "${projectName}" all sidecars are fresh.`
    }
  }
  return {
    id: `anchors-staleness/${projectName}`,
    status: 'warning',
    message: `Project "${projectName}" has ${stale.length} stale sidecar(s) — files were modified after the last generate.`,
    hint: `Re-run \`skmtc generate ${projectName} --anchors\` to refresh.`,
    data: { stale }
  }
}

// ─── Internals ─────────────────────────────────────────────────────

const readAnchorsConfig = (projectPath: string): AnchorsSettings | undefined => {
  const clientJsonPath = join(projectPath, '.settings', 'client.json')
  if (!existsSync(clientJsonPath)) return undefined
  try {
    const parsed: unknown = expandClientJson(JSON.parse(Deno.readTextFileSync(clientJsonPath)))
    const raw: unknown = (parsed as { settings?: { anchors?: unknown } })?.settings?.anchors
    if (raw === undefined) return undefined
    const result = v.safeParse(anchorsSettings, raw)
    return result.success ? result.output : undefined
  } catch {
    return undefined
  }
}

const readManifest = (manifestPath: string): { files: Record<string, { destinationPath: string }> } | undefined => {
  try {
    const parsedJson = JSON.parse(Deno.readTextFileSync(manifestPath))
    const result = v.safeParse(manifestContent, parsedJson)
    return result.success ? result.output : undefined
  } catch {
    return undefined
  }
}

const mtimeOf = (path: string): number | null => {
  try {
    const stat = Deno.statSync(path)
    return stat.mtime?.getTime() ?? null
  } catch {
    return null
  }
}

const formatPct = (n: number): string => `${(n * 100).toFixed(1)}%`
