// Mechanical freshness check for the SKILL.md §6 scaffolds.
//
// Extracts every ```ts code block whose first line is a `// gen-x/<path>`
// marker, materializes them as a synthetic generator package in a temp
// dir pinned to the workspace's CURRENT @skmtc/core and
// @skmtc/lang-typescript versions, and runs `deno check`. A scaffold that
// no longer compiles against shipped core is exactly the drift class an
// LLM judge misses and a typechecker catches.
//
// Usage (from this directory):
//   deno run --allow-read --allow-write --allow-env --allow-run=deno --allow-net scaffold-check.ts
//
// Exit 0: all scaffolds typecheck. Exit 1: check failed (temp dir is kept
// and printed for inspection). Exit 2: setup error.

import { dirname, fromFileUrl, join, resolve } from "jsr:@std/path@^1"
import { ensureDir } from "jsr:@std/fs@^1"

const GEN_TYPESCRIPT_PIN = "0.2.3"

async function readWorkspaceVersion(denoJsonPath: string): Promise<string> {
  const parsed: unknown = JSON.parse(await Deno.readTextFile(denoJsonPath))
  if (
    typeof parsed !== "object" || parsed === null ||
    !("version" in parsed) || typeof parsed.version !== "string"
  ) {
    throw new Error(`No version field in ${denoJsonPath}`)
  }
  return parsed.version
}

type Scaffold = { relPath: string; code: string }

function extractScaffolds(skillText: string): Scaffold[] {
  const scaffolds: Scaffold[] = []
  const blockRe = /```ts\n(\/\/ gen-x\/(\S+)\n[\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = blockRe.exec(skillText)) !== null) {
    scaffolds.push({ relPath: match[2], code: match[1] })
  }
  return scaffolds
}

async function main(): Promise<void> {
  const evalDir = dirname(fromFileUrl(import.meta.url))
  const skillPath = resolve(evalDir, "..", "SKILL.md")
  const denoRoot = resolve(evalDir, "..", "..", "..", "..")

  const [skillText, coreVersion, langVersion] = await Promise.all([
    Deno.readTextFile(skillPath),
    readWorkspaceVersion(join(denoRoot, "core", "deno.json")),
    readWorkspaceVersion(join(denoRoot, "lang-typescript", "deno.json")),
  ])

  const scaffolds = extractScaffolds(skillText)
  if (scaffolds.length === 0) {
    console.error(
      "No `// gen-x/<path>`-marked ```ts blocks found in SKILL.md — " +
        "either the scaffolds were renamed or the marker convention changed.",
    )
    Deno.exit(2)
  }
  console.error(
    `Extracted ${scaffolds.length} scaffold file(s): ${scaffolds.map((s) => s.relPath).join(", ")}`,
  )

  const tmpDir = await Deno.makeTempDir({ prefix: "skmtc-scaffold-check-" })

  const denoJson = {
    name: "@scaffold/gen-x",
    version: "0.0.1",
    exports: "./src/mod.ts",
    imports: {
      "@skmtc/core": `jsr:@skmtc/core@${coreVersion}`,
      "@skmtc/lang-typescript": `jsr:@skmtc/lang-typescript@${langVersion}`,
      "@skmtc/gen-typescript": `jsr:@skmtc/gen-typescript@${GEN_TYPESCRIPT_PIN}`,
      "@std/path": "jsr:@std/path@^1",
      "valibot": "npm:valibot@^1.0.0",
      "tiny-invariant": "npm:tiny-invariant@^1.3.3",
    },
  }
  await Deno.writeTextFile(
    join(tmpDir, "deno.json"),
    JSON.stringify(denoJson, null, 2) + "\n",
  )

  const entrypoints: string[] = []
  for (const scaffold of scaffolds) {
    const outPath = join(tmpDir, scaffold.relPath)
    await ensureDir(dirname(outPath))
    await Deno.writeTextFile(outPath, scaffold.code)
    entrypoints.push(scaffold.relPath)
  }

  const check = new Deno.Command("deno", {
    args: ["check", ...entrypoints],
    cwd: tmpDir,
    stdout: "inherit",
    stderr: "inherit",
  })
  const { code } = await check.output()

  if (code === 0) {
    console.error(
      `Scaffolds OK against @skmtc/core@${coreVersion} + @skmtc/lang-typescript@${langVersion}`,
    )
    await Deno.remove(tmpDir, { recursive: true })
    Deno.exit(0)
  }

  console.error(`Scaffold check FAILED — package kept at ${tmpDir}`)
  Deno.exit(1)
}

if (import.meta.main) {
  await main()
}
