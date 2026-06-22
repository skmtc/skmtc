/**
 * Headless `project fork` / `project rm` — ephemeral, per-branch hub projects.
 *
 * The model: a long-lived **base** project (`client.json#project`, e.g.
 * `@acme/petstore-client`) is the canonical anchor; each git branch forks it
 * into a short-lived project that carries that branch's enrichment edits. Edit
 * in the fork's rail → `skmtc pull` → commit → PR → merge → `project rm`. Git is
 * the source of truth; the fork is a transient editing surface (the per-PR
 * preview-environment pattern).
 *
 * `fork` composes existing hub endpoints — it does NOT invent a new one:
 *   1. resolve the base (`client.json#project`) and the ephemeral slug
 *      (`--as`, else `<base-slug>-<git-branch>`);
 *   2. `GET /projects/{base}` to inherit its stack + API bindings (so a fork is
 *      near-zero-config — you don't re-specify the generators or the schema);
 *   3. `POST /projects` with those bindings (the fork);
 *   4. `PUT …/client-config` to seed the fork from the branch's local config;
 *   5. optionally `PUT …/preview/base-files`.
 *
 * `rm` deletes the ephemeral project (`DELETE /projects/{ephemeral}`), which the
 * hub gates behind the `admin:resource` scope — see the reference doc.
 */

import { join } from "@std/path/join";
import type { SkmtcRoot } from "@/lib/skmtc-root.ts";
import { parseScopedName } from "@/lib/scoped-name.ts";
import { toAbsoluteRootPath } from "@/lib/to-root-path.ts";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Read the current git branch from `.git/HEAD` (no `git` spawn — the CLI's
 *  permission set forbids it). Returns undefined on detached HEAD or no repo. */
async function readGitBranch(): Promise<string | undefined> {
  try {
    const head = await Deno.readTextFile(join(toAbsoluteRootPath(), ".git", "HEAD"));
    const match = head.match(/^ref:\s*refs\/heads\/(.+?)\s*$/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/** `feat/Applicants_Form` -> `feat-applicants-form` (slug-safe). */
const sanitizeBranch = (branch: string): string =>
  branch.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

type Scoped = { account: string; slug: string };

/** Resolve the ephemeral `@account/slug`: `--as` wins, else `<base>-<branch>`. */
async function resolveEphemeral(
  base: Scoped,
  asFlag: string | undefined,
): Promise<{ ephemeral: Scoped; branch?: string } | { error: string }> {
  const explicit = asFlag?.trim();
  if (explicit) {
    const parsed = parseScopedName(explicit);
    return parsed ? { ephemeral: parsed } : { error: `invalid --as "${explicit}" — expected @account/slug` };
  }
  const branch = await readGitBranch();
  if (!branch) {
    return {
      error:
        "no git branch to derive a slug from (detached HEAD or not a repo) — pass --as @account/slug",
    };
  }
  return { ephemeral: { account: base.account, slug: `${base.slug}-${sanitizeBranch(branch)}` }, branch };
}

type ForkArgs = {
  skmtcRoot: SkmtcRoot;
  projectName: string;
  token: string;
  origin: string;
  /** Ephemeral destination override (`@account/slug`); else `<base>-<branch>`. */
  asFlag?: string;
  visibility?: "public" | "private";
  /** Collected base files to also seed (app-root-relative path -> content). */
  baseFiles?: Record<string, string>;
};

export type ForkResult =
  | {
    kind: "forked";
    projectName: string;
    base: Scoped;
    ephemeral: Scoped;
    origin: string;
    branch?: string;
    /** Whether the project was newly created (false = it already existed, re-seeded). */
    created: boolean;
    enrichmentCount: number;
    baseFilesPushed?: number;
    /** Project page URL, when the hub returns one. */
    url?: string;
  }
  | {
    kind: "failed";
    projectName: string;
    reason: string;
    stage: "read" | "base" | "create" | "seed";
  };

const arrayLen = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

export const forkHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  origin,
  asFlag,
  visibility = "private",
  baseFiles,
}: ForkArgs): Promise<ForkResult> => {
  const project = skmtcRoot.findProject(projectName);
  const contents = project.clientJson.contents;
  if (!contents) {
    return {
      kind: "failed",
      projectName,
      reason: `no client.json for "${projectName}" (.skmtc/${projectName}/.settings/client.json)`,
      stage: "read",
    };
  }
  const baseSpec = contents.project?.trim();
  if (!baseSpec) {
    return {
      kind: "failed",
      projectName,
      reason:
        'no base project to fork — set `project: "@account/slug"` in client.json (the canonical project this branch forks)',
      stage: "read",
    };
  }
  const base = parseScopedName(baseSpec);
  if (!base) {
    return { kind: "failed", projectName, reason: `invalid base "${baseSpec}" — expected @account/slug`, stage: "read" };
  }

  const resolved = await resolveEphemeral(base, asFlag);
  if ("error" in resolved) {
    return { kind: "failed", projectName, reason: resolved.error, stage: "read" };
  }
  const { ephemeral, branch } = resolved;

  const headers = { authorization: `Bearer ${token}` };

  // Inherit the base project's stack + API bindings.
  let baseProject: Record<string, unknown>;
  try {
    const res = await fetch(`${origin}/v1/projects/${base.account}/${base.slug}`, { headers });
    if (res.status === 404) {
      return {
        kind: "failed",
        projectName,
        reason: `base project ${base.account}/${base.slug} not found at ${origin} — create it first`,
        stage: "base",
      };
    }
    if (!res.ok) {
      const text = await res.text();
      return { kind: "failed", projectName, reason: `reading base failed (${res.status}): ${text.slice(0, 300)}`, stage: "base" };
    }
    const body: unknown = await res.json();
    if (!isObject(body) || !isObject(body.stack) || !isObject(body.api)) {
      return { kind: "failed", projectName, reason: "base project missing stack/api bindings", stage: "base" };
    }
    baseProject = body;
  } catch (err) {
    return { kind: "failed", projectName, reason: err instanceof Error ? err.message : String(err), stage: "base" };
  }

  const stack = baseProject.stack;
  const api = baseProject.api;
  if (
    !isObject(stack) || typeof stack.account !== "string" || typeof stack.slug !== "string" ||
    !isObject(api) || typeof api.account !== "string" || typeof api.slug !== "string"
  ) {
    return { kind: "failed", projectName, reason: "base project missing stack/api account or slug", stage: "base" };
  }
  const createBody = {
    owner: ephemeral.account,
    slug: ephemeral.slug,
    visibility,
    description: `branch fork of ${base.account}/${base.slug}${branch ? ` (${branch})` : ""}`,
    stack: `${stack.account}/${stack.slug}`,
    stackPin: baseProject.stackPin,
    api: `${api.account}/${api.slug}`,
    apiPin: baseProject.apiPin,
  };

  // Create the fork. 409 = it already exists → re-seed (idempotent).
  let created = true;
  let projectUrl: string | undefined;
  try {
    const res = await fetch(`${origin}/v1/projects`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(createBody),
    });
    if (res.status === 409) {
      created = false;
      await res.text();
    } else if (!res.ok) {
      const text = await res.text();
      const hint = res.status === 403 ? ` — not authorized to create under ${ephemeral.account}` : "";
      return { kind: "failed", projectName, reason: `create failed (${res.status})${hint}: ${text.slice(0, 300)}`, stage: "create" };
    } else {
      const body: unknown = await res.json();
      if (isObject(body) && typeof body.htmlUrl === "string") projectUrl = body.htmlUrl;
    }
  } catch (err) {
    return { kind: "failed", projectName, reason: err instanceof Error ? err.message : String(err), stage: "create" };
  }

  // Seed config from the branch's local client.json.
  let enrichmentCount = 0;
  try {
    const settings = contents.settings;
    const seedBody = {
      source: contents.source,
      settings: {
        basePath: settings.basePath ?? ".",
        packages: settings.packages,
        include: settings.include,
        skip: settings.skip,
        enrichments: settings.enrichments,
        inputDirs: settings.inputDirs,
      },
    };
    const res = await fetch(`${origin}/v1/projects/${ephemeral.account}/${ephemeral.slug}/client-config`, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(seedBody),
    });
    if (!res.ok) {
      const text = await res.text();
      return { kind: "failed", projectName, reason: `config seed failed (${res.status}) — fork created: ${text.slice(0, 300)}`, stage: "seed" };
    }
    const seedResult: unknown = await res.json();
    enrichmentCount = isObject(seedResult) ? arrayLen(seedResult.enrichments) : 0;
  } catch (err) {
    return { kind: "failed", projectName, reason: err instanceof Error ? err.message : String(err), stage: "seed" };
  }

  // Optional base-files seed (for the live preview container).
  let baseFilesPushed: number | undefined;
  if (baseFiles && Object.keys(baseFiles).length > 0) {
    try {
      const res = await fetch(`${origin}/v1/projects/${ephemeral.account}/${ephemeral.slug}/preview/base-files`, {
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ files: baseFiles }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { kind: "failed", projectName, reason: `base-files seed failed (${res.status}) — config already seeded: ${text.slice(0, 300)}`, stage: "seed" };
      }
      await res.text();
      baseFilesPushed = Object.keys(baseFiles).length;
    } catch (err) {
      return { kind: "failed", projectName, reason: err instanceof Error ? err.message : String(err), stage: "seed" };
    }
  }

  return {
    kind: "forked",
    projectName,
    base,
    ephemeral,
    origin,
    branch,
    created,
    enrichmentCount,
    baseFilesPushed,
    url: projectUrl,
  };
};

type RmArgs = {
  skmtcRoot: SkmtcRoot;
  projectName: string;
  token: string;
  origin: string;
  asFlag?: string;
};

export type RmResult =
  | { kind: "removed"; projectName: string; ephemeral: Scoped; origin: string; existed: boolean }
  | { kind: "failed"; projectName: string; reason: string; stage: "read" | "delete" };

export const rmHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  origin,
  asFlag,
}: RmArgs): Promise<RmResult> => {
  const project = skmtcRoot.findProject(projectName);
  const contents = project.clientJson.contents;
  if (!contents) {
    return { kind: "failed", projectName, reason: `no client.json for "${projectName}"`, stage: "read" };
  }
  const baseSpec = contents.project?.trim();
  if (!baseSpec) {
    return { kind: "failed", projectName, reason: "no base project in client.json to derive the ephemeral slug — pass --as", stage: "read" };
  }
  const base = parseScopedName(baseSpec);
  if (!base) {
    return { kind: "failed", projectName, reason: `invalid base "${baseSpec}"`, stage: "read" };
  }
  const resolved = await resolveEphemeral(base, asFlag);
  if ("error" in resolved) {
    return { kind: "failed", projectName, reason: resolved.error, stage: "read" };
  }
  const { ephemeral } = resolved;

  try {
    const res = await fetch(`${origin}/v1/projects/${ephemeral.account}/${ephemeral.slug}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 404) {
      return { kind: "removed", projectName, ephemeral, origin, existed: false };
    }
    if (!res.ok) {
      const text = await res.text();
      const hint = res.status === 403
        ? ` — deleting a project needs the 'admin:resource' scope (your token lacks it)`
        : "";
      return { kind: "failed", projectName, reason: `delete failed (${res.status})${hint}: ${text.slice(0, 300)}`, stage: "delete" };
    }
    await res.text();
    return { kind: "removed", projectName, ephemeral, origin, existed: true };
  } catch (err) {
    return { kind: "failed", projectName, reason: err instanceof Error ? err.message : String(err), stage: "delete" };
  }
};
