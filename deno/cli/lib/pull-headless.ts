/**
 * Headless `pull` path — the hub→local counterpart to `push`. Fetches an
 * EXISTING skmtc-hub project's config from `/client-config` (the nested
 * `client.json#settings` shape) and folds it into the local
 * `.skmtc/<project>/.settings/client.json`. The read half of the PR-based
 * enrichment round-trip: a user edits enrichments in the hub, pulls them down,
 * regenerates locally, commits.
 *
 * Field-merge policy (single-user, last-write-wins — the Phase-4 plan layers
 * fast-forward + structured 3-way merge on top later):
 *   - `enrichments`, `include`, `skip` are REPLACED from the hub (the shared,
 *     hub-edited config). An empty hub value drops the local key, so a cleared
 *     filter doesn't leave `[]` / `{}` noise behind.
 *   - `basePath`, `packages`, `inputDirs`, `source`, `project` are PRESERVED from
 *     the local file — local wiring that differs per checkout and must never be
 *     clobbered by the hub's copy.
 *
 * The merged config is re-validated through `@skmtc/core`'s `skmtcClientConfig`,
 * whose enrichment schema is opaque (`v.record(..., v.unknown())`), so
 * generator-owned enrichment payloads pass through untouched.
 *
 * Flow mirrors push: resolve the destination (`--project` →
 * `client.json#project`), GET (404 → "create it in the web app first"), merge,
 * and write only when the result differs from the local file.
 */

import { skmtcClientConfig } from "@skmtc/core/Settings";
import type { SkmtcRoot } from "@/lib/skmtc-root.ts";
import { parseScopedName } from "@/lib/scoped-name.ts";
import { parseOrExplain } from "@/lib/parse-or-explain.ts";

type PullHeadlessArgs = {
  skmtcRoot: SkmtcRoot;
  projectName: string;
  /** Personal access token. */
  token: string;
  /** Hub origin (base URL). */
  origin: string;
  /** Destination override (`@account/slug`); falls back to `client.json#project`. */
  projectFlag?: string;
  /**
   * Interactive overwrite gate. Called only when the pull would CHANGE the local
   * file; returning `false` aborts. Omitted in strict/agent mode, so the pull
   * overwrites local config without prompting.
   */
  confirmOverwrite?: (
    info: { account: string; slug: string; enrichmentGenerators: number },
  ) => Promise<boolean>;
};

export type PullHeadlessResult =
  | {
    kind: "pulled";
    projectName: string;
    project: { account: string; slug: string };
    origin: string;
    /** Whether the merged config differed from the local file (i.e. it was rewritten). */
    changed: boolean;
    /** Absolute path written, or null when nothing changed. */
    wrote: string | null;
    /** Generator slots carrying enrichments in the pulled config (excludes `_stack`). */
    enrichmentGenerators: number;
    /** Whether an explicit `--project` was recorded into client.json. */
    remoteWritten: boolean;
  }
  | {
    kind: "aborted";
    projectName: string;
    project: { account: string; slug: string };
  }
  | {
    kind: "failed";
    projectName: string;
    reason: string;
    stage: "read" | "destination" | "pull";
  };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmpty = (value: unknown): boolean =>
  (Array.isArray(value) && value.length > 0) ||
  (isObject(value) && Object.keys(value).length > 0);

/**
 * Fold one hub settings key into the merged bag: set it when the hub carries a
 * non-empty value, otherwise drop the local key. A filter the hub cleared is
 * therefore cleared locally without leaving an empty `[]` / `{}` behind.
 */
const applyHubKey = (
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void => {
  if (isNonEmpty(value)) target[key] = value;
  else delete target[key];
};

/** Recursively key-sorted JSON, for an order-insensitive change check. */
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) {
    const body = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? "null";
};

const enrichmentGeneratorCount = (enrichments: unknown): number =>
  isObject(enrichments)
    ? Object.keys(enrichments).filter((key) => key !== "_stack").length
    : 0;

export const pullHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  origin,
  projectFlag,
  confirmOverwrite,
}: PullHeadlessArgs): Promise<PullHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName);
  const contents = project.clientJson.contents;
  if (!contents) {
    return {
      kind: "failed",
      projectName,
      reason:
        `no client.json for "${projectName}" (.skmtc/${projectName}/.settings/client.json)`,
      stage: "read",
    };
  }

  const destSpec = projectFlag?.trim() || contents.project?.trim();
  if (!destSpec) {
    return {
      kind: "failed",
      projectName,
      reason:
        'no hub destination — set `project: "@account/slug"` in client.json or pass --project @account/slug',
      stage: "destination",
    };
  }
  const dest = parseScopedName(destSpec);
  if (!dest) {
    return {
      kind: "failed",
      projectName,
      reason: `invalid hub destination "${destSpec}" — expected @account/slug`,
      stage: "destination",
    };
  }
  const { account, slug } = dest;

  // Fetch the hub's config as a nested client.json. A 404 is decisive: pull
  // targets an existing project, exactly like push.
  let hubBody: unknown;
  try {
    const getResponse = await fetch(
      `${origin}/v1/projects/${account}/${slug}/client-config`,
      { method: "GET", headers: { authorization: `Bearer ${token}` } },
    );
    if (getResponse.status === 404) {
      return {
        kind: "failed",
        projectName,
        reason:
          `project ${account}/${slug} not found at ${origin} — create it in the web app first ` +
          `(pull targets an existing project)`,
        stage: "pull",
      };
    }
    if (!getResponse.ok) {
      const text = await getResponse.text();
      const hint = getResponse.status === 403
        ? ` — not authorized to read ${account}/${slug}`
        : "";
      return {
        kind: "failed",
        projectName,
        reason: `client-config pull failed (${getResponse.status})${hint}: ${
          text.slice(0, 500)
        }`,
        stage: "pull",
      };
    }
    hubBody = await getResponse.json();
  } catch (err) {
    return {
      kind: "failed",
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: "pull",
    };
  }

  if (!isObject(hubBody) || !isObject(hubBody.settings)) {
    return {
      kind: "failed",
      projectName,
      reason: `unexpected response from ${origin} — missing settings object`,
      stage: "pull",
    };
  }
  const hubSettings = hubBody.settings;

  // Merge: replace the shared hub-edited keys; preserve local wiring untouched.
  const mergedSettings: Record<string, unknown> = { ...contents.settings };
  applyHubKey(mergedSettings, "enrichments", hubSettings.enrichments);
  applyHubKey(mergedSettings, "include", hubSettings.include);
  applyHubKey(mergedSettings, "skip", hubSettings.skip);

  // `-u`: an explicit --project is recorded so later pulls are bare `skmtc pull`.
  const withProject = projectFlag?.trim()
    ? { ...contents, project: destSpec }
    : contents;
  const mergedRaw = { ...withProject, settings: mergedSettings };

  // Re-validate the merged config. Enrichment leaves are opaque to this schema
  // (`v.unknown()`), so generator-specific payloads survive verbatim.
  let merged: typeof contents;
  try {
    merged = parseOrExplain(
      skmtcClientConfig,
      mergedRaw,
      `pulled client.json for "${projectName}"`,
    );
  } catch (err) {
    return {
      kind: "failed",
      projectName,
      reason: `pulled config failed validation: ${
        err instanceof Error ? err.message : String(err)
      }`,
      stage: "pull",
    };
  }

  const enrichmentGenerators = enrichmentGeneratorCount(hubSettings.enrichments);
  const changed = stableStringify(merged) !== stableStringify(contents);

  if (!changed) {
    return {
      kind: "pulled",
      projectName,
      project: { account, slug },
      origin,
      changed: false,
      wrote: null,
      enrichmentGenerators,
      remoteWritten: false,
    };
  }

  if (confirmOverwrite) {
    const proceed = await confirmOverwrite({ account, slug, enrichmentGenerators });
    if (!proceed) {
      return { kind: "aborted", projectName, project: { account, slug } };
    }
  }

  project.clientJson.contents = merged;
  await project.clientJson.write();

  const remoteWritten = Boolean(projectFlag?.trim()) &&
    contents.project?.trim() !== destSpec;

  return {
    kind: "pulled",
    projectName,
    project: { account, slug },
    origin,
    changed: true,
    wrote: project.clientJson.path,
    enrichmentGenerators,
    remoteWritten,
  };
};
