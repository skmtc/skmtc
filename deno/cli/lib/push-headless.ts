/**
 * Headless `push` path. Pushes a local project's `client.json` to an EXISTING
 * skmtc-hub project, where it becomes the project's editable config (the web
 * CMS edits the same flat config). This is the project-level counterpart to
 * `publish` (which publishes an immutable *stack* version).
 *
 * Flow:
 *   1. Resolve the hub destination — `--project @account/slug` wins, else the
 *      `project` field in `.skmtc/<project>/.settings/client.json` (the git-remote
 *      analog). No destination → fail before any network call.
 *   2. GET the destination's current config — 404 means the project doesn't
 *      exist (push targets an existing project; create it in the web app first).
 *      When it already holds config, `confirmOverwrite` (interactive only) gates
 *      the overwrite.
 *   3. PUT the local `client.json` (`{ source?, settings }`) to
 *      `/v1/projects/{account}/{slug}/client-config`. The hub folds the nested
 *      settings into its flat ProjectConfig and overwrites it, returning the
 *      result.
 *   4. `-u`: an explicit `--project` is written back into `client.json` so later
 *      pushes are bare `skmtc push`.
 *
 * The hub authorizes the PUT against the *destination* account (writer on the
 * project, org membership included) — identity (the PAT) is separate from
 * destination (the `project` field), exactly like git.
 */

import type { SkmtcRoot } from "@/lib/skmtc-root.ts";
import { parseScopedName } from "@/lib/scoped-name.ts";

type PushHeadlessArgs = {
  skmtcRoot: SkmtcRoot;
  projectName: string;
  /** Personal access token. */
  token: string;
  /** Hub origin (base URL). */
  origin: string;
  /** Destination override (`@account/slug`); falls back to `client.json#project`. */
  projectFlag?: string;
  /**
   * Interactive overwrite gate. Called only when the destination already holds
   * config; returning `false` aborts the push. Omitted in strict/agent mode, so
   * the push overwrites without prompting.
   */
  confirmOverwrite?: (
    info: { account: string; slug: string; enrichmentCount: number },
  ) => Promise<boolean>;
  /**
   * Collected base files (app-root-relative path -> text content) to also push
   * to `/preview/base-files`, replacing the project's stored set. Omitted unless
   * `--base-files` was passed.
   */
  baseFiles?: Record<string, string>;
};

export type PushHeadlessResult =
  | {
    kind: "pushed";
    projectName: string;
    project: { account: string; slug: string };
    origin: string;
    /** Enrichment rows in the resulting hub config. */
    enrichmentCount: number;
    /** Whether the destination already held config that this push replaced. */
    overwroteExistingConfig: boolean;
    /** Whether an explicit `--project` was written back into client.json. */
    remoteWritten: boolean;
    /** Number of base files pushed — present only when `--base-files` ran. */
    baseFilesPushed?: number;
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
    stage: "read" | "destination" | "push";
  };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const arrayLength = (payload: Record<string, unknown>, key: string): number => {
  const value = payload[key];
  return Array.isArray(value) ? value.length : 0;
};

const toEnrichmentCount = (payload: unknown): number =>
  isObject(payload) ? arrayLength(payload, "enrichments") : 0;

/** Whether a fetched ProjectConfig already carries meaningful config. */
const hasConfigData = (payload: unknown): boolean =>
  isObject(payload) &&
  (arrayLength(payload, "enrichments") > 0 ||
    arrayLength(payload, "include") > 0 ||
    arrayLength(payload, "skip") > 0);

export const pushHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  origin,
  projectFlag,
  confirmOverwrite,
  baseFiles,
}: PushHeadlessArgs): Promise<PushHeadlessResult> => {
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

  // Pre-check the destination's current config for the overwrite warning. A 404
  // is decisive: push targets an existing project, it never creates one. Other
  // non-OK statuses are swallowed (best-effort) — the PUT below is authoritative.
  let existing: unknown;
  try {
    const getResponse = await fetch(
      `${origin}/v1/projects/${account}/${slug}/config`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    if (getResponse.status === 404) {
      return {
        kind: "failed",
        projectName,
        reason:
          `project ${account}/${slug} not found at ${origin} — create it in the web app first ` +
          `(push targets an existing project, it does not create one)`,
        stage: "push",
      };
    }
    if (getResponse.ok) existing = await getResponse.json();
    else await getResponse.text();
  } catch {
    // A failed pre-check shouldn't block the push; the PUT is authoritative.
  }

  const overwroteExistingConfig = hasConfigData(existing);
  if (overwroteExistingConfig && confirmOverwrite) {
    const proceed = await confirmOverwrite({
      account,
      slug,
      enrichmentCount: toEnrichmentCount(existing),
    });
    if (!proceed) {
      return { kind: "aborted", projectName, project: { account, slug } };
    }
  }

  const settings = contents.settings;
  const body = {
    source: contents.source,
    settings: {
      basePath: settings.basePath ?? ".",
      packages: settings.packages,
      include: settings.include,
      skip: settings.skip,
      enrichments: settings.enrichments,
    },
  };

  let pushedConfig: unknown;
  try {
    const putResponse = await fetch(
      `${origin}/v1/projects/${account}/${slug}/client-config`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!putResponse.ok) {
      const text = await putResponse.text();
      const hint = putResponse.status === 403
        ? ` — not authorized to write to ${account}/${slug}`
        : putResponse.status === 404
        ? ` — project ${account}/${slug} not found`
        : "";
      return {
        kind: "failed",
        projectName,
        reason: `client-config push failed (${putResponse.status})${hint}: ${
          text.slice(0, 500)
        }`,
        stage: "push",
      };
    }
    pushedConfig = await putResponse.json();
  } catch (err) {
    return {
      kind: "failed",
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: "push",
    };
  }

  // Optional base-files push (--base-files): replace the project's stored app
  // tree via the existing endpoint. The config PUT above already landed, so a
  // failure here is surfaced but flagged as partial.
  let baseFilesPushed: number | undefined;
  if (baseFiles && Object.keys(baseFiles).length > 0) {
    try {
      const filesResponse = await fetch(
        `${origin}/v1/projects/${account}/${slug}/preview/base-files`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ files: baseFiles }),
        },
      );
      if (!filesResponse.ok) {
        const text = await filesResponse.text();
        return {
          kind: "failed",
          projectName,
          reason:
            `base-files push failed (${filesResponse.status}) — client-config was already updated: ${
              text.slice(0, 500)
            }`,
          stage: "push",
        };
      }
      await filesResponse.text();
      baseFilesPushed = Object.keys(baseFiles).length;
    } catch (err) {
      return {
        kind: "failed",
        projectName,
        reason: `base-files push failed — client-config was already updated: ${
          err instanceof Error ? err.message : String(err)
        }`,
        stage: "push",
      };
    }
  }

  // `-u`: persist an explicit `--project` into client.json so the destination is
  // remembered. Non-fatal — the push already succeeded.
  let remoteWritten = false;
  if (projectFlag?.trim() && contents.project?.trim() !== destSpec) {
    try {
      project.clientJson.contents = { ...contents, project: destSpec };
      await project.clientJson.write();
      remoteWritten = true;
    } catch {
      // The push succeeded; the write-back is a convenience.
    }
  }

  return {
    kind: "pushed",
    projectName,
    project: { account, slug },
    origin,
    enrichmentCount: toEnrichmentCount(pushedConfig),
    overwroteExistingConfig,
    remoteWritten,
    baseFilesPushed,
  };
};
