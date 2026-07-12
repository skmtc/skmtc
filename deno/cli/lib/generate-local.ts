import { join } from "@std/path";
import { GenerateArtifacts } from "@/lib/generate-artifacts.ts";
import {
  writeGeneratedFiles,
  type WriteGeneratedFilesResult,
} from "@/lib/write-generated-files.ts";
import type { ClientSettings } from "@skmtc/core/Settings";
import {
  reanchorSidecar,
  upgradeSidecar,
  writeSidecars,
} from "@skmtc/core/Anchors";
import { oxcAdapter } from "@skmtc/core/Anchors/oxc";
import { toResolvedArtifactPath } from "@skmtc/core";
import {
  type GenerationStats,
  toGenerationStats,
} from "@/lib/generationStats.ts";
import type { FileType } from "@/lib/types.ts";
import type { ParseIssue } from "@skmtc/core";
import { toAttributionPayload } from "@/lib/to-attribution-payload.ts";

type GenerateLocalArgs = {
  bundlePath: string;
  schemaContents: string;
  /**
   * File type of the schema source. Determines whether the worker
   * receives an OpenAPI document object or raw GraphQL SDL.
   */
  fileType: FileType;
  clientSettings: ClientSettings | undefined;
  /**
   * When set (from `client.json#serverUrl`), generate against this deployed
   * stack server over HTTP instead of the local `bundle.js`.
   */
  stackUrl?: string;
  manifestPath: string;
  /**
   * Filesystem path of the project — `.skmtc/<project>/`. Used to
   * resolve the `anchors.out` subdirectory for sidecar writes.
   */
  projectPath: string;
  /**
   * Source identifier for the schema (URL or path). Lands on each
   * sidecar's `src` field. Optional — degrades to `''` when missing.
   */
  schemaSource: string | undefined;
  /**
   * CLI flag override for the `anchors.enabled` config field.
   * - `true` from `--anchors` — force on regardless of config
   * - `false` from `--no-anchors` — force off regardless of config
   * - `undefined` (default) — use the config value
   */
  anchorsFlag?: boolean;
  /**
   * Forwarded to `writeGeneratedFiles`. Watch mode passes `false` and
   * prints its own one-line protected-file status per rebuild instead
   * of the writer's multi-line stderr warning.
   */
  warnOnProtected?: boolean;
};

/**
 * Per-run summary of gen-maps output. Populated only when the
 * project's `client.json#settings.anchors.enabled` is `true` (or
 * a future `--anchors` flag overrides it on).
 */
export type GenerateLocalAnchorsStats = {
  /** Absolute path of the `.maps` subtree on disk. */
  outDir: string;
  /** Number of sidecars (and the rollup file) written. */
  filesWritten: number;
  /** Total bytes written across all sidecars + the generation map. */
  totalBytes: number;
  /** Number of Definition entries in the generation map. */
  generationMapEntries: number;
};

export type GenerateLocalResult = {
  stats: GenerationStats;
  /**
   * Parse-time issues for this run. Sourced from `manifest.parseIssues`
   * (the manifest is now the persistent record of every run-level
   * diagnostic); surfaced separately here for convenience so the CLI
   * summary doesn't have to re-dig into the manifest.
   */
  parseIssues: ParseIssue[];
  /**
   * Paths of every file the run wrote, relative to the SKMTC root.
   * Surfaced so `--json` consumers (and agents) can see exactly where
   * the output landed without re-parsing the manifest — closes
   * friction #14 in structured form.
   */
  filePaths: string[];
  /**
   * Gen-maps summary. Present only when anchors were enabled and the
   * post-pass actually ran. Mirrored to the `--json` output.
   */
  anchors?: GenerateLocalAnchorsStats;
  /**
   * Artifact paths the run left untouched because their on-disk
   * content has manual edits (see `WriteGeneratedFilesResult`).
   * Surfaced structurally for `--json` consumers; the human-readable
   * warning already landed on stderr.
   */
  protectedPaths: string[];
  /**
   * Drift report for ejected files (see `WriteGeneratedFilesResult`).
   * Present only when the project has ejected files.
   */
  ejections?: WriteGeneratedFilesResult["ejections"];
};

export const generateLocal = async ({
  bundlePath,
  schemaContents,
  fileType,
  clientSettings,
  stackUrl,
  manifestPath,
  projectPath,
  schemaSource,
  anchorsFlag,
  warnOnProtected,
}: GenerateLocalArgs): Promise<GenerateLocalResult> => {
  try {
    const attribution = toAttributionPayload({
      anchors: clientSettings?.anchors,
      schemaSource,
      flagOverride: anchorsFlag,
    });

    const { artifacts, manifest, sidecars, generationMap } =
      await GenerateArtifacts.generateWithWorker({
        bundlePath,
        schemaContents,
        fileType,
        clientSettings,
        attribution,
        stackUrl,
      });

    const { protectedPaths, ejections, onDiskDrift } = writeGeneratedFiles({
      manifestPath,
      artifacts,
      manifest,
      clientSettings,
      projectPath,
      warnOnProtected,
    });

    let anchorsStats: GenerateLocalAnchorsStats | undefined;
    if (sidecars && generationMap) {
      // Host-side post-pass, two steps per sidecar:
      // 1. `upgradeSidecar` — the worker built sidecars without a parser
      //    (empty AST paths); re-resolve landmarks + paths against the
      //    RAW render with the real oxc adapter.
      // 2. `reanchorSidecar` — when the on-disk file drifted from the
      //    render (the consumer's `settings.formatter` ran), realign the
      //    spans to the FORMATTED text so the written sidecar describes
      //    the file as it exists on disk.
      // Artifacts are keyed by resolved path; sidecar `f` is `@/`-aliased.
      const sidecarArtifacts = new Set<string>();
      const realignedArtifacts = new Set<string>();
      const upgradedSidecars = Object.fromEntries(
        Object.entries(sidecars).map(([filePath, sidecar]) => {
          const artifactKey = toResolvedArtifactPath({
            basePath: clientSettings?.basePath,
            destinationPath: sidecar.f,
          });
          sidecarArtifacts.add(artifactKey);
          const source = artifacts[artifactKey];
          if (typeof source !== "string") return [filePath, sidecar];
          const upgraded = upgradeSidecar({
            sidecar,
            source,
            parser: oxcAdapter,
          });
          const onDisk = onDiskDrift[artifactKey];
          if (onDisk === undefined) return [filePath, upgraded];
          const realigned = reanchorSidecar({
            sidecar: upgraded,
            source: onDisk,
            parser: oxcAdapter,
          });
          // Realignment failed → keep raw coordinates; the manifest for
          // this file stays raw too (below), so the reader's drift
          // trigger still fires and re-anchors at read time.
          if (realigned === undefined) return [filePath, upgraded];
          realignedArtifacts.add(artifactKey);
          return [filePath, realigned];
        }),
      );
      const outDir = join(projectPath, clientSettings?.anchors?.out ?? ".maps");
      const { written, totalBytes } = await writeSidecars({
        sidecars: upgradedSidecars,
        generationMap,
        outDir,
      });
      anchorsStats = {
        outDir,
        filesWritten: written.length,
        totalBytes,
        generationMapEntries: generationMap.length,
      };

      // Manifest realignment: `characters`/`lines` describe the file as
      // written on disk — but ONLY where the sidecar spans agree (or the
      // artifact has no sidecar, e.g. JSON). Updating the manifest
      // without realigned spans would silence the reader's drift
      // detection and serve stale spans as aligned.
      const realignableDrift = Object.entries(onDiskDrift).filter(
        ([artifactKey]) =>
          !sidecarArtifacts.has(artifactKey) ||
          realignedArtifacts.has(artifactKey),
      );
      if (realignableDrift.length > 0) {
        for (const [artifactKey, content] of realignableDrift) {
          const fileMeta = manifest.files[artifactKey];
          if (fileMeta === undefined) continue;
          fileMeta.characters = content.length;
          fileMeta.lines = content.split("\n").length;
        }
        Deno.writeTextFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }
    }

    const stats = toGenerationStats({ manifest, artifacts });

    return {
      stats,
      parseIssues: manifest.parseIssues,
      filePaths: Object.keys(artifacts),
      anchors: anchorsStats,
      protectedPaths,
      ...(ejections ? { ejections } : {}),
    };
  } catch (error) {
    console.error(
      error instanceof Error ? error : "Failed to generate artifacts",
    );

    throw error;
  }
};
