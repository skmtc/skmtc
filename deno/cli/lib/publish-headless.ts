/**
 * Headless `publish` path. Builds the single self-contained bundle and uploads
 * it together with the project source in ONE atomic multipart request,
 * publishing a new immutable version of the stack package.
 *
 * Flow:
 *   1. Resolve the version to publish — the `--version` flag wins, otherwise
 *      the project root `deno.json#version`. No version → fail before any
 *      network call. Versions are immutable; the hub returns `409` when the
 *      semver is already published.
 *   2. `resolveAccountHandle` — the PAT resolves to the stack account; the
 *      project name is the stack slug. Stack identity is `<handle>/<project>`.
 *   3. `bundleDeploy(project)` → `<project>/server.js` — one self-contained
 *      bundle (generators + `createServer` + `@skmtc/core` + `@skmtc/server`,
 *      nothing external).
 *   4. `collectSourceFiles(project)` — the user-authored source tree, filtered
 *      by built-in defaults + the project's optional `.skmtcignore`.
 *   5. `POST /v1/stacks/{account}/{stack}/versions` (multipart) with the
 *      `version` part + `bundle` part + one `files` part per source file. The
 *      hub writes bundle + source to R2, reconciles the stack's generator
 *      composition from the uploaded `deno.json`, and returns the complete
 *      StackVersion. There is no metadata-only intermediate state — the
 *      publish is atomic.
 *
 * Versions are addressed by semver — there is no deployment id, shortId, or
 * `production` alias here. Deployments (and the alias) belong to *projects*
 * and are driven from the web app, not the CLI.
 */

import { join } from "@std/path/join";
import type { SkmtcRoot } from "@/lib/skmtc-root.ts";
import { bundleDeploy } from "@/lib/bundle-deploy.ts";
import { collectSourceFiles, type SourceFile } from "@/lib/source-upload.ts";
import { parseScopedName } from "@/lib/scoped-name.ts";

type PublishHeadlessArgs = {
  skmtcRoot: SkmtcRoot;
  projectName: string;
  /** Personal access token. */
  token: string;
  /** Hub base URL — defaults to https://api.skmtc.dev. */
  origin?: string;
  /**
   * Version override from `--version`. When absent the version is read
   * from the project root `deno.json#version`.
   */
  version?: string;
};

export type PublishHeadlessResult =
  | {
    kind: "published";
    projectName: string;
    bundlePath: string;
    bundleBytes: number;
    bundleSha256: string;
    stack: { account: string; slug: string };
    /** The published semver. */
    version: string;
    /** Canonical SPA URL for the published version. */
    versionUrl: string;
    sourceFileCount: number;
    sourceTotalBytes: number;
  }
  | {
    kind: "failed";
    projectName: string;
    reason: string;
    stage: "version" | "identity" | "bundle" | "publish";
  };

const DEFAULT_ORIGIN = "https://api.skmtc.dev";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Read the project root `deno.json#version`, or `undefined` when the file
 * is missing, unparseable, or carries no usable `version` string. The
 * caller turns `undefined` into the recipe-style "set a version" failure.
 */
const readProjectVersion = async (
  projectPath: string,
): Promise<string | undefined> => {
  try {
    const contents = await Deno.readTextFile(join(projectPath, "deno.json"));
    const parsed: unknown = JSON.parse(contents);
    if (!isObject(parsed)) return undefined;
    const version = parsed["version"];
    return typeof version === "string" ? version : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Read the project root `deno.json#name` (the stack's JSR-style package name),
 * or `undefined` when the file is missing, unparseable, or has no `name`. The
 * caller turns `undefined`/unscoped into the recipe-style "set a name" failure.
 */
const readProjectName = async (
  projectPath: string,
): Promise<string | undefined> => {
  try {
    const contents = await Deno.readTextFile(join(projectPath, "deno.json"));
    const parsed: unknown = JSON.parse(contents);
    if (!isObject(parsed)) return undefined;
    const name = parsed["name"];
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Resolve the version to publish: the `--version` flag wins, then the
 * project root `deno.json#version`. Both are trimmed; empty values count
 * as missing. Throws when neither source yields a version — publishing
 * never invents or auto-bumps a semver (the hub rejects duplicates with
 * `409`, which we surface verbatim).
 *
 * Exported for tests.
 */
export const resolveStackVersion = async ({
  projectPath,
  versionFlag,
}: {
  projectPath: string;
  versionFlag?: string;
}): Promise<string> => {
  const fromFlag = versionFlag?.trim();
  if (fromFlag) return fromFlag;

  const fromDenoJson = (await readProjectVersion(projectPath))?.trim();
  if (fromDenoJson) return fromDenoJson;

  throw new Error(
    "no version to publish — set a `version` in the project's deno.json or pass --version <semver>",
  );
};

/**
 * Resolve the stack identity from the project root `deno.json#name` — a stack is
 * a JSR-style package, so its identity is its package name `@account/slug` (the
 * `@account` scope may be an org). Throws the recipe when the name is missing or
 * not a scoped name; publishing never falls back to the authenticated handle.
 *
 * Exported for tests.
 */
export const resolveStackName = async (
  projectPath: string,
): Promise<{ account: string; slug: string }> => {
  const name = (await readProjectName(projectPath))?.trim();
  const parsed = name ? parseScopedName(name) : null;
  if (!parsed) {
    throw new Error(
      'no stack name to publish to — set `name` to "@account/slug" in the project deno.json',
    );
  }
  return parsed;
};

/**
 * Read a file into a fresh `ArrayBuffer`. `Deno.readFile` returns
 * `Uint8Array<ArrayBufferLike>` whose underlying buffer might be a
 * `SharedArrayBuffer`, which fetch bodies reject. Copy into a
 * non-shared `ArrayBuffer`.
 */
const readArrayBuffer = async (path: string): Promise<ArrayBuffer> => {
  const u8 = await Deno.readFile(path);
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
};

type StackVersionResponse = {
  version: string;
  versionUrl: string;
  bundleBytes: number;
  bundleSha256: string;
  sourceFileCount: number;
  sourceTotalBytes: number;
};

/**
 * POST the version + bundle + source tree in one atomic multipart request
 * and parse the returned StackVersion. The hub writes R2, reconciles the
 * composition, and returns the complete version (bundle + source populated).
 *
 * Exported for tests.
 */
export const publishVersion = async ({
  origin,
  token,
  account,
  slug,
  version,
  bundle,
  files,
}: {
  origin: string;
  token: string;
  account: string;
  slug: string;
  version: string;
  bundle: ArrayBuffer;
  files: SourceFile[];
}): Promise<StackVersionResponse> => {
  if (files.length === 0) throw new Error("no source files to upload");

  const form = new FormData();
  form.append("version", version);
  form.append(
    "bundle",
    new Blob([bundle], { type: "application/javascript" }),
    "server.js",
  );
  for (const file of files) {
    // The hub reads each `files` part's filename as the path relative to the
    // project root (FormData sets `Content-Disposition: filename` from the
    // third argument).
    form.append(
      "files",
      new Blob([file.bytes], { type: file.contentType }),
      file.path,
    );
  }

  const response = await fetch(
    `${origin}/v1/stacks/${account}/${slug}/versions`,
    {
      method: "POST",
      headers: { "authorization": `Bearer ${token}` },
      body: form,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 409) {
      throw new Error(
        `version ${version} is already published for ${account}/${slug} — versions are ` +
          `immutable. Bump the version in the project's deno.json (or pass a new ` +
          `--version) and re-publish. Hub said: ${text.slice(0, 500)}`,
      );
    }
    throw new Error(
      `version publish failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  const payload: unknown = await response.json();
  if (!isObject(payload)) throw new Error("hub returned non-object payload");
  const publishedVersion = payload["version"];
  const versionUrl = payload["htmlUrl"];
  const bundleField = payload["bundle"];
  const sourceField = payload["source"];
  if (
    typeof publishedVersion !== "string" ||
    typeof versionUrl !== "string" ||
    !isObject(bundleField) ||
    !isObject(sourceField)
  ) {
    throw new Error("hub stack version payload had unexpected shape");
  }
  const bundleBytes = bundleField["bytes"];
  const bundleSha256 = bundleField["sha256"];
  const sourceFileCount = sourceField["fileCount"];
  const sourceTotalBytes = sourceField["totalBytes"];
  if (
    typeof bundleBytes !== "number" ||
    typeof bundleSha256 !== "string" ||
    typeof sourceFileCount !== "number" ||
    typeof sourceTotalBytes !== "number"
  ) {
    throw new Error(
      "hub stack version payload had unexpected bundle/source shape",
    );
  }
  return {
    version: publishedVersion,
    versionUrl,
    bundleBytes,
    bundleSha256,
    sourceFileCount,
    sourceTotalBytes,
  };
};

export const publishHeadless = async ({
  skmtcRoot,
  projectName,
  token,
  origin = DEFAULT_ORIGIN,
  version: versionFlag,
}: PublishHeadlessArgs): Promise<PublishHeadlessResult> => {
  const project = skmtcRoot.findProject(projectName);

  // Resolve the version first — before any network call — so a missing
  // version fails fast with the recipe instead of after a bundle build.
  let version: string;
  try {
    version = await resolveStackVersion({
      projectPath: project.toPath(),
      versionFlag,
    });
  } catch (err) {
    return {
      kind: "failed",
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: "version",
    };
  }

  // The stack identity is the project deno.json#name (@account/slug) — a stack
  // is a JSR-style package; the @account scope may be an org.
  let account: string;
  let slug: string;
  try {
    const stack = await resolveStackName(project.toPath());
    account = stack.account;
    slug = stack.slug;
  } catch (err) {
    return {
      kind: "failed",
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: "identity",
    };
  }

  let bundlePath: string;
  let bundleBuffer: ArrayBuffer;
  let files: SourceFile[];
  try {
    const built = await bundleDeploy({ project });
    bundlePath = built.projectBundlePath;
    bundleBuffer = await readArrayBuffer(bundlePath);
    files = await collectSourceFiles(project.toPath());
  } catch (err) {
    return {
      kind: "failed",
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: "bundle",
    };
  }

  let published: StackVersionResponse;
  try {
    published = await publishVersion({
      origin,
      token,
      account,
      slug,
      version,
      bundle: bundleBuffer,
      files,
    });
  } catch (err) {
    return {
      kind: "failed",
      projectName,
      reason: err instanceof Error ? err.message : String(err),
      stage: "publish",
    };
  }

  return {
    kind: "published",
    projectName,
    bundlePath,
    bundleBytes: published.bundleBytes,
    bundleSha256: published.bundleSha256,
    stack: { account, slug },
    version: published.version,
    versionUrl: published.versionUrl,
    sourceFileCount: published.sourceFileCount,
    sourceTotalBytes: published.sourceTotalBytes,
  };
};
