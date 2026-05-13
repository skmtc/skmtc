#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { join, relative } from "@std/path";
import { walk } from "@std/fs/walk";

const LOCAL_JSR_URL = "https://jsr.skmtc.dev/";
const STATE_FILE_RELATIVE = ".scripts/.publish-state.json";
const ALWAYS_EXCLUDED_SEGMENTS = new Set(["node_modules", ".git", "coverage"]);
const ALWAYS_EXCLUDED_SUFFIXES = [".lcov"];

type ImportMap = Record<string, string>;

type DenoJson = {
  name?: string;
  version?: string;
  imports?: ImportMap;
  workspace?: string[];
  publish?: { exclude?: string[] };
  [key: string]: unknown;
};

type WorkspacePackage = {
  name: string;
  dir: string;
  dirRelative: string;
  version: string;
  publishExclude: string[];
  imports: ImportMap;
  localDeps: string[];
};

type PublishState = {
  packages: Record<string, { version: string; hash: string }>;
};

type ReleasePlan = {
  bumps: Map<string, string>;
  imports: Map<string, ImportMap>;
  topoOrder: string[];
  publishOrder: string[];
};

export function incrementPatchVersion(version: string): string {
  const parts = version.split(".");
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${version}`);
  }
  const [major, minor, patch] = parts;
  if (!/^\d+$/.test(patch)) {
    throw new Error(`Invalid patch version: ${patch} is not a valid number`);
  }
  return `${major}.${minor}.${parseInt(patch, 10) + 1}`;
}

async function readDenoJson(filePath: string): Promise<DenoJson> {
  const text = await Deno.readTextFile(filePath);
  return JSON.parse(text);
}

async function writeDenoJson(filePath: string, data: DenoJson): Promise<void> {
  await Deno.writeTextFile(filePath, JSON.stringify(data, null, 2) + "\n");
}

async function readState(rootPath: string): Promise<PublishState> {
  const path = join(rootPath, STATE_FILE_RELATIVE);
  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { packages: {} };
    }
    throw error;
  }
}

async function writeState(
  rootPath: string,
  state: PublishState,
): Promise<void> {
  const path = join(rootPath, STATE_FILE_RELATIVE);
  await Deno.writeTextFile(path, JSON.stringify(state, null, 2) + "\n");
}

function parseLocalImport(
  value: string,
): { name: string; version: string } | null {
  const match = value.match(
    /^jsr:(@skmtc\/[^@\s/]+)@(?:\^|~)?([0-9]+\.[0-9]+\.[0-9]+)(?:\/.*)?$/,
  );
  if (!match) return null;
  return { name: match[1], version: match[2] };
}

function rewriteImportValue(value: string, newVersion: string): string {
  return value.replace(
    /^(jsr:@skmtc\/[^@\s/]+)@(?:\^|~)?[0-9]+\.[0-9]+\.[0-9]+(\/.*)?$/,
    `$1@${newVersion}$2`,
  );
}

function extractLocalDeps(
  imports: ImportMap | undefined,
  workspaceNames: Set<string>,
): string[] {
  if (!imports) return [];
  const deps = new Set<string>();
  for (const value of Object.values(imports)) {
    const parsed = parseLocalImport(value);
    if (parsed && workspaceNames.has(parsed.name)) {
      deps.add(parsed.name);
    }
  }
  return [...deps];
}

function matchesPublishExclude(relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.endsWith("/")) {
      if (relPath === pattern.slice(0, -1) || relPath.startsWith(pattern)) {
        return true;
      }
      continue;
    }
    if (relPath === pattern) return true;
  }
  return false;
}

function shouldHashFile(relPath: string, publishExclude: string[]): boolean {
  const segments = relPath.split("/");
  for (const segment of segments) {
    if (ALWAYS_EXCLUDED_SEGMENTS.has(segment)) return false;
  }
  for (const suffix of ALWAYS_EXCLUDED_SUFFIXES) {
    if (relPath.endsWith(suffix)) return false;
  }
  if (matchesPublishExclude(relPath, publishExclude)) return false;
  return true;
}

export async function hashPackageSources(
  packageDir: string,
  publishExclude: string[],
): Promise<string> {
  const entries: Array<{ relPath: string; bytes: Uint8Array }> = [];

  for await (
    const entry of walk(packageDir, {
      includeDirs: false,
      includeSymlinks: false,
    })
  ) {
    const relPath = relative(packageDir, entry.path).split("\\").join("/");
    if (!shouldHashFile(relPath, publishExclude)) continue;

    let bytes: Uint8Array;
    if (relPath === "deno.json") {
      const json = await readDenoJson(entry.path);
      const stripped: DenoJson = { ...json };
      delete stripped.version;
      bytes = new TextEncoder().encode(JSON.stringify(stripped));
    } else {
      bytes = await Deno.readFile(entry.path);
    }
    entries.push({ relPath, bytes });
  }

  entries.sort((
    a,
    b,
  ) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const entry of entries) {
    chunks.push(encoder.encode(entry.relPath));
    chunks.push(new Uint8Array([0]));
    chunks.push(entry.bytes);
    chunks.push(new Uint8Array([0]));
  }

  const totalLen = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const digest = await crypto.subtle.digest("SHA-256", merged);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function discoverWorkspace(
  rootPath: string,
): Promise<WorkspacePackage[]> {
  const rootConfig = await readDenoJson(join(rootPath, "deno.json"));
  if (!rootConfig.workspace) {
    throw new Error("No workspace configuration found in root deno.json");
  }

  const workspaceRels = rootConfig.workspace.map((w) =>
    w.startsWith("./") ? w.slice(2) : w
  );

  const rawPackages: Array<{
    dirRelative: string;
    dir: string;
    config: DenoJson;
  }> = [];

  for (const dirRelative of workspaceRels) {
    const dir = join(rootPath, dirRelative);
    const config = await readDenoJson(join(dir, "deno.json"));
    if (!config.name || !config.version) {
      console.warn(`Skipping ${dirRelative}: missing name or version`);
      continue;
    }
    rawPackages.push({ dirRelative, dir, config });
  }

  const workspaceNames = new Set(rawPackages.map((p) => {
    if (!p.config.name) {
      throw new Error(`Missing name after filter: ${p.dirRelative}`);
    }
    return p.config.name;
  }));

  return rawPackages.map(({ dirRelative, dir, config }) => {
    if (!config.name || !config.version) {
      throw new Error(`Unreachable: ${dirRelative} missing name/version`);
    }
    return {
      name: config.name,
      dir,
      dirRelative,
      version: config.version,
      publishExclude: config.publish?.exclude ?? [],
      imports: config.imports ?? {},
      localDeps: extractLocalDeps(config.imports, workspaceNames),
    };
  });
}

function topologicalOrder(packages: WorkspacePackage[]): string[] {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const pkg of packages) {
    inDegree.set(pkg.name, pkg.localDeps.length);
    for (const dep of pkg.localDeps) {
      const list = dependents.get(dep) ?? [];
      list.push(pkg.name);
      dependents.set(dep, list);
    }
  }

  const queue: string[] = [];
  for (const [name, deg] of inDegree) {
    if (deg === 0) queue.push(name);
  }
  queue.sort();

  const order: string[] = [];
  while (queue.length > 0) {
    const name = queue.shift();
    if (name === undefined) break;
    order.push(name);
    for (const dependent of dependents.get(name) ?? []) {
      const next = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, next);
      if (next === 0) {
        queue.push(dependent);
        queue.sort();
      }
    }
  }

  if (order.length !== packages.length) {
    const missing = packages.map((p) => p.name).filter((n) =>
      !order.includes(n)
    );
    throw new Error(
      `Dependency cycle detected involving: ${missing.join(", ")}`,
    );
  }

  return order;
}

function hasSourceChanged(
  recorded: { version: string; hash: string } | undefined,
  currentVersion: string,
  currentHash: string | undefined,
): boolean {
  if (!recorded) return true;
  if (recorded.version !== currentVersion) return true;
  if (recorded.hash !== currentHash) return true;
  return false;
}

function decideAction(
  shouldBump: boolean,
  versionUnpublished: boolean,
  depPublished: boolean,
): "bump-and-publish" | "publish-as-is" | "none" {
  if (shouldBump && versionUnpublished) return "publish-as-is";
  if (shouldBump && !versionUnpublished) return "bump-and-publish";
  if (!shouldBump && versionUnpublished) return "publish-as-is";
  if (depPublished) return "publish-as-is";
  return "none";
}

export async function planRelease(
  packages: WorkspacePackage[],
  state: PublishState,
): Promise<ReleasePlan> {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const topoOrder = topologicalOrder(packages);

  const currentHashes = new Map<string, string>();
  for (const pkg of packages) {
    currentHashes.set(
      pkg.name,
      await hashPackageSources(pkg.dir, pkg.publishExclude),
    );
  }

  const sourceChanged = new Map<string, boolean>();
  for (const pkg of packages) {
    const recorded = state.packages[pkg.name];
    sourceChanged.set(
      pkg.name,
      hasSourceChanged(recorded, pkg.version, currentHashes.get(pkg.name)),
    );
  }

  const bumps = new Map<string, string>();
  const needsPublish = new Set<string>();
  const importUpdates = new Map<string, ImportMap>();

  for (const name of topoOrder) {
    const pkg = byName.get(name);
    if (!pkg) throw new Error(`Unreachable: missing package ${name}`);

    const depBumped = pkg.localDeps.some((d) => bumps.has(d));
    const depPublished = pkg.localDeps.some((d) => needsPublish.has(d));

    const updatedImports: ImportMap = { ...pkg.imports };
    let importsChanged = false;
    for (const [key, value] of Object.entries(pkg.imports)) {
      const parsed = parseLocalImport(value);
      if (!parsed || !byName.has(parsed.name)) continue;
      const depPkg = byName.get(parsed.name);
      if (!depPkg) continue;
      const depVersion = bumps.get(parsed.name) ?? depPkg.version;
      const rewritten = rewriteImportValue(value, depVersion);
      if (rewritten !== value) {
        updatedImports[key] = rewritten;
        importsChanged = true;
      }
    }
    if (importsChanged) {
      importUpdates.set(name, updatedImports);
    }

    const shouldBump = Boolean(sourceChanged.get(name)) || depBumped ||
      importsChanged;
    const recorded = state.packages[name];
    const versionUnpublished = !recorded || recorded.version !== pkg.version;
    const action = decideAction(shouldBump, versionUnpublished, depPublished);

    switch (action) {
      case "bump-and-publish":
        bumps.set(name, incrementPatchVersion(pkg.version));
        needsPublish.add(name);
        break;
      case "publish-as-is":
        needsPublish.add(name);
        break;
      case "none":
        break;
    }
  }

  const publishOrder = topoOrder.filter((name) => needsPublish.has(name));

  return {
    bumps,
    imports: importUpdates,
    topoOrder,
    publishOrder,
  };
}

async function applyPlan(
  packages: WorkspacePackage[],
  plan: ReleasePlan,
): Promise<void> {
  const byName = new Map(packages.map((p) => [p.name, p]));
  for (const name of plan.topoOrder) {
    const pkg = byName.get(name);
    if (!pkg) continue;
    const newVersion = plan.bumps.get(name);
    const newImports = plan.imports.get(name);
    if (!newVersion && !newImports) continue;

    const denoJsonPath = join(pkg.dir, "deno.json");
    const config = await readDenoJson(denoJsonPath);
    if (newVersion) config.version = newVersion;
    if (newImports) config.imports = newImports;
    await writeDenoJson(denoJsonPath, config);

    const versionLog = newVersion
      ? `${pkg.version} -> ${newVersion}`
      : `${pkg.version} (unchanged)`;
    console.log(
      `  ${pkg.name}: ${versionLog}${newImports ? " (imports rewritten)" : ""}`,
    );
  }
}

async function runPublish(packageDir: string): Promise<void> {
  const command = new Deno.Command("deno", {
    args: ["task", "publish"],
    cwd: packageDir,
    env: { JSR_URL: LOCAL_JSR_URL },
    stdout: "inherit",
    stderr: "inherit",
  });
  const result = await command.output();
  if (!result.success) {
    throw new Error(`Publish failed for ${packageDir} (exit ${result.code})`);
  }
}

export async function release(rootPath: string = Deno.cwd()): Promise<void> {
  console.log("Discovering workspace packages...");
  const packages = await discoverWorkspace(rootPath);
  console.log(
    `  Found ${packages.length}: ${packages.map((p) => p.name).join(", ")}`,
  );

  console.log("\nLoading publish state...");
  const state = await readState(rootPath);
  const known = Object.keys(state.packages).length;
  console.log(`  ${known} package(s) tracked in ${STATE_FILE_RELATIVE}`);

  console.log("\nPlanning release...");
  const plan = await planRelease(packages, state);

  if (plan.publishOrder.length === 0) {
    console.log("\nNothing to publish. All packages up to date.");
    return;
  }

  console.log("\nPlan:");
  for (const name of plan.publishOrder) {
    const bump = plan.bumps.get(name);
    console.log(
      `  ${name}: ${bump ? `bump to ${bump}` : "publish at current version"}`,
    );
  }

  console.log("\nApplying version + import changes...");
  await applyPlan(packages, plan);

  console.log("\nPublishing to local JSR (in dependency order)...");
  const byName = new Map(packages.map((p) => [p.name, p]));
  const newState: PublishState = { packages: { ...state.packages } };

  for (const name of plan.publishOrder) {
    const pkg = byName.get(name);
    if (!pkg) {
      throw new Error(`Unreachable: missing package ${name} in publish loop`);
    }
    const newVersion = plan.bumps.get(name) ?? pkg.version;

    console.log(`\n--- Publishing ${name}@${newVersion} ---`);
    await runPublish(pkg.dir);

    const hash = await hashPackageSources(pkg.dir, pkg.publishExclude);
    newState.packages[name] = { version: newVersion, hash };
    await writeState(rootPath, newState);
  }

  console.log("\nRelease complete.");
}

if (import.meta.main) {
  try {
    await release();
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exit(1);
  }
}
