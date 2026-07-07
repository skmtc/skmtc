#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/**
 * Doc-test — typecheck the fenced TypeScript blocks in the docs tree
 * against the CURRENT workspace source.
 *
 * docs-writing §7: "a fenced code block is a claim; untested claims
 * rot." This harness makes the claim checkable: every ```ts block in
 * the reader-facing tree (+ skills + llms.md) whose imports resolve
 * inside this workspace is extracted to `docs/.doc-test/` and run
 * through `deno check`. Workspace member resolution means
 * `@skmtc/core` / `@skmtc/lang-typescript` imports typecheck against
 * the live packages, so a renamed export or changed signature breaks
 * the doc block that quotes it.
 *
 * The contract: **a block with import statements claims to be
 * self-contained** — it is extracted and must typecheck. Import-less
 * blocks are treated as fragments (signature sketches, snippets using
 * ambient names like `context`) — the dominant, legitimate shape in
 * reference and concept pages — and are skipped by default.
 *
 * Info-string markers override the default in both directions:
 *   - ```ts fragment — a block WITH imports that is deliberately not
 *     self-contained; skipped.
 *   - ```ts check — an import-less block that should be verified
 *     anyway; checked.
 *
 * Also skipped (each skip is counted and reported):
 *   - blocks importing app-context or out-of-workspace modules
 *     (relative paths, `@skmtc/gen-*`, npm UI packages) — inherently
 *     fragments of a consumer project;
 *   - ```tsx blocks (JSX compiler config is out of scope for v1).
 *
 * Ratchet baseline: `docs/doc-test-baseline.json` pins the block IDs
 * that failed when the harness was introduced. A failure NOT in the
 * baseline fails the run (regression); a baselined block that now
 * passes also fails the run (ratchet — shrink the baseline). Run with
 * `--update-baseline` to rewrite the baseline to the current failure
 * set after triaging.
 *
 *   exit 0 — no new failures, no stale baseline entries.
 *   exit 1 — a non-baselined block fails, a baselined block passes,
 *            or `deno check` aborted (module-graph error).
 *
 * Usage:  deno run --allow-read --allow-write --allow-run --allow-env \
 *           docs/doc-test.ts [--update-baseline] [--verbose]
 * CI runs this via `deno task verify-docs`.
 */

import { dirname, fromFileUrl, join, relative } from "jsr:@std/path@^1";

const docsDir = dirname(fromFileUrl(import.meta.url));
const denoDir = join(docsDir, "..");
const outDir = join(docsDir, ".doc-test");
const baselinePath = join(docsDir, "doc-test-baseline.json");

const updateBaseline = Deno.args.includes("--update-baseline");
const verbose = Deno.args.includes("--verbose");

// ---------------------------------------------------------------------
// Collect markdown files: the reader-facing tree, skills, llms.md.
// ---------------------------------------------------------------------

const markdownFiles: string[] = [join(docsDir, "llms.md")];

const collectMarkdown = async (dir: string): Promise<void> => {
  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory) {
      await collectMarkdown(path);
    } else if (entry.name.endsWith(".md") && entry.name !== "CLAUDE.md") {
      markdownFiles.push(path);
    }
  }
};

for (
  const dir of ["using", "authoring", "reference", "concepts", "explanation"]
) {
  await collectMarkdown(join(docsDir, dir));
}
for await (const entry of Deno.readDir(join(docsDir, "skills"))) {
  if (!entry.isDirectory) continue;
  const skillFile = join(docsDir, "skills", entry.name, "SKILL.md");
  try {
    await Deno.stat(skillFile);
    markdownFiles.push(skillFile);
  } catch {
    // skill dir without SKILL.md — nothing to check
  }
}

// ---------------------------------------------------------------------
// Extract fenced ts/tsx blocks.
// ---------------------------------------------------------------------

type Block = {
  /** `<page>#<n>` — page-relative ordinal of the ts/tsx block. */
  id: string;
  page: string;
  /** 1-indexed line of the opening fence. */
  line: number;
  lang: string;
  /** Info-string words after the language tag. */
  flags: string[];
  code: string;
};

const blocks: Block[] = [];

for (const file of markdownFiles) {
  const page = relative(docsDir, file);
  const lines = (await Deno.readTextFile(file)).split("\n");

  let ordinal = 0;
  let open: { lang: string; flags: string[]; line: number } | undefined;
  let buffer: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (open) {
      if (/^\s*```\s*$/.test(line)) {
        blocks.push({
          id: `${page}#${ordinal}`,
          page,
          line: open.line,
          lang: open.lang,
          flags: open.flags,
          code: buffer.join("\n"),
        });
        ordinal++;
        open = undefined;
        buffer = [];
      } else {
        buffer.push(line);
      }
      continue;
    }
    const fence = line.match(/^\s*```(tsx?)\b(.*)$/);
    if (fence) {
      open = {
        lang: fence[1],
        flags: fence[2].trim().split(/\s+/).filter(Boolean),
        line: index + 1,
      };
    } else if (/^\s*```/.test(line)) {
      // Non-ts fence — consume until it closes so nested content
      // (including ``` inside output samples) can't open a ts block.
      for (index++; index < lines.length; index++) {
        if (/^\s*```\s*$/.test(lines[index])) break;
      }
    }
  }
}

// ---------------------------------------------------------------------
// Classify: checkable vs skipped. A block is checkable when every
// import specifier resolves inside this workspace — a workspace
// member, a root deno.json import (or subpath of one), or a fully
// qualified jsr:/npm: specifier.
// ---------------------------------------------------------------------

const rootConfig = JSON.parse(
  await Deno.readTextFile(join(denoDir, "deno.json")),
) as { workspace?: string[]; imports?: Record<string, string> };

const memberNames = new Set<string>();
for (const member of rootConfig.workspace ?? []) {
  try {
    const memberConfig = JSON.parse(
      await Deno.readTextFile(join(denoDir, member, "deno.json")),
    ) as { name?: string };
    if (memberConfig.name) memberNames.add(memberConfig.name);
  } catch {
    // member without deno.json — not importable by name
  }
}

const rootImports = Object.keys(rootConfig.imports ?? {});

const isResolvable = (specifier: string): boolean => {
  if (specifier.startsWith("jsr:") || specifier.startsWith("npm:")) {
    return true;
  }
  if (memberNames.has(specifier)) return true;
  return rootImports.some(
    (key) => specifier === key || specifier.startsWith(`${key}/`),
  );
};

const importPattern =
  /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

type Skip = { block: Block; reason: string };

const checkable: Block[] = [];
const skipped: Skip[] = [];

for (const block of blocks) {
  if (block.flags.includes("fragment")) {
    skipped.push({ block, reason: "marked fragment" });
    continue;
  }
  if (block.lang === "tsx") {
    skipped.push({ block, reason: "tsx (JSX config out of scope)" });
    continue;
  }
  const specifiers = [...block.code.matchAll(importPattern)].map(
    (match) => match[1] ?? match[2],
  );
  if (specifiers.length === 0 && !block.flags.includes("check")) {
    skipped.push({ block, reason: "no imports (implicit fragment)" });
    continue;
  }
  const unresolvable = specifiers.filter(
    (specifier) => !isResolvable(specifier),
  );
  if (unresolvable.length > 0) {
    skipped.push({
      block,
      reason: `unresolvable import: ${[...new Set(unresolvable)].join(", ")}`,
    });
    continue;
  }
  checkable.push(block);
}

// ---------------------------------------------------------------------
// Write block files and run one batched `deno check`.
// ---------------------------------------------------------------------

await Deno.remove(outDir, { recursive: true }).catch(() => {});
await Deno.mkdir(outDir, { recursive: true });

const fileToId = new Map<string, string>();

for (const block of checkable) {
  const slug = block.id.replace(/[^a-zA-Z0-9]+/g, "_");
  const path = join(outDir, `${slug}.ts`);
  fileToId.set(path, block.id);
  await Deno.writeTextFile(
    path,
    `// extracted from ${block.page}:${block.line} (${block.id})\n${block.code}\n`,
  );
}

// A fatal module-graph error (syntax error, unresolvable specifier)
// ABORTS `deno check` at the first offending file, hiding every other
// result. Peel those files off one retry at a time; the surviving set
// then reports all TS diagnostics in a single run.
const failingIds = new Set<string>();
let remaining = [...fileToId.keys()];

while (remaining.length > 0) {
  const check = await new Deno.Command("deno", {
    args: ["check", "--quiet", ...remaining],
    cwd: denoDir,
    env: { NO_COLOR: "1" },
    stdout: "piped",
    stderr: "piped",
  }).output();

  const checkOutput = new TextDecoder().decode(check.stderr) +
    new TextDecoder().decode(check.stdout);

  if (check.code === 0) break;

  const attributed = new Set<string>();
  for (const match of checkOutput.matchAll(/(?:file:\/\/)?(\/[^\s:]+\.ts)/g)) {
    if (fileToId.has(match[1])) attributed.add(match[1]);
  }

  if (attributed.size === 0) {
    console.error(
      "deno check failed but no block file could be attributed — raw output:\n",
    );
    console.error(checkOutput);
    Deno.exit(1);
  }

  for (const path of attributed) {
    failingIds.add(fileToId.get(path) as string);
  }

  const isFatal = /^error:/m.test(checkOutput);
  if (!isFatal) break;
  // Fatal abort: only the first offender was reported. Drop the
  // attributed file(s) and re-run to surface the rest.
  remaining = remaining.filter((path) => !attributed.has(path));
}

// ---------------------------------------------------------------------
// Baseline ratchet.
// ---------------------------------------------------------------------

const currentFailures = [...failingIds].sort();

if (updateBaseline) {
  await Deno.writeTextFile(
    baselinePath,
    JSON.stringify(currentFailures, null, 2) + "\n",
  );
}

let baseline: string[];
try {
  baseline = JSON.parse(await Deno.readTextFile(baselinePath)) as string[];
} catch {
  await Deno.writeTextFile(
    baselinePath,
    JSON.stringify(currentFailures, null, 2) + "\n",
  );
  baseline = currentFailures;
  console.log(
    `bootstrap: wrote ${currentFailures.length} failing block(s) to ${
      relative(denoDir, baselinePath)
    }`,
  );
}

const baselineSet = new Set(baseline);
const newFailures = currentFailures.filter((id) => !baselineSet.has(id));
const staleEntries = baseline.filter((id) => !failingIds.has(id));

// ---------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------

if (verbose) {
  for (const { block, reason } of skipped) {
    console.log(`skip  ${block.id} — ${reason}`);
  }
  for (const id of currentFailures) {
    console.log(`fail  ${id}${baselineSet.has(id) ? " (baselined)" : ""}`);
  }
}

for (const id of newFailures) {
  const block = checkable.find((candidate) => candidate.id === id);
  console.log(
    `FAIL  ${id} (${block?.page}:${block?.line}) — does not typecheck ` +
      `against the workspace; fix the block, or mark the fence ` +
      "```ts fragment if it is deliberately not self-contained",
  );
}
for (const id of staleEntries) {
  console.log(
    `FAIL  stale baseline entry ${id} — the block now passes (or was ` +
      `removed/renumbered); run with --update-baseline after checking ` +
      `the diff`,
  );
}

const skipsByReason = new Map<string, number>();
for (const { reason } of skipped) {
  const key = reason.split(":")[0];
  skipsByReason.set(key, (skipsByReason.get(key) ?? 0) + 1);
}

console.log(
  `\n${blocks.length} ts/tsx blocks across ${markdownFiles.length} files: ` +
    `${checkable.length} checked (${
      checkable.length - currentFailures.length
    } pass, ${currentFailures.length} fail, of which ${
      currentFailures.length - newFailures.length
    } baselined), ${skipped.length} skipped (${
      [...skipsByReason.entries()].map(([reason, count]) =>
        `${count} ${reason}`
      ).join(", ")
    }).`,
);

const failed = newFailures.length > 0 || staleEntries.length > 0;
console.log(
  failed
    ? `${newFailures.length} new failure(s), ${staleEntries.length} stale baseline entr(ies).`
    : "Doc-test holds.",
);
Deno.exit(failed ? 1 : 0);
