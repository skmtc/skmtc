/** Fixture: a small working Deno CLI (tool/export.ts) plus a
 * deliberately flawed how-to page (guides/export-data.md) documenting
 * it. Exercises the docs-writing skill — especially §1.1 verify-first:
 * the page's central fault is FACTUAL drift only visible by checking
 * the source or running the tool.
 *
 * Planted faults, keyed to the docs-writing checklist (§14):
 *   - documents a `--force` flag that doesn't exist (real: --overwrite)
 *   - wrong defaults (claims out/ + csv; real: dist/ + json)      §1.1
 *   - opens with project history instead of the task; no prereqs  §1.3
 *   - design-rationale digression mid-guide (type mixing)         §3
 *   - filler (simply/just/easily), "please", anthropomorphism,
 *     time-bound words (currently/new/will)                       §4
 *   - multi-action steps, no expected results, no completing
 *     action                                                      §5
 *   - "click here" link, "as mentioned above", skipped heading
 *     level (H2 → H4)                                             §6
 *   - three names for one thing (export file / output bundle /
 *     artifact)                                                   §4
 *
 * Self-verification: proves the tool's REAL behavior first (help
 * text, default dist/export.json, --overwrite gating), resets the
 * output, then asserts the faults are planted (page mentions --force
 * and out/). A fixture that only plants faults could drift from the
 * tool it lies about.
 *
 * Requires: deno on PATH. No skmtc / network dependency.
 */

import { join } from "jsr:@std/path@^1";

const sandbox = Deno.args[0];
if (!sandbox) {
  console.error("usage: deno run -A setup.ts <sandboxDir>");
  Deno.exit(2);
}

const cliSource = `const usage = \`expo — export table data

Usage: deno run --allow-read --allow-write tool/export.ts [options]

Options:
  --out <dir>     Output directory (default: dist)
  --format <fmt>  Output format: json or csv (default: json)
  --overwrite     Replace an existing output directory
  --help          Show this help
\`

type Options = { out: string; format: 'json' | 'csv'; overwrite: boolean }

const parseArgs = (args: string[]): Options => {
  const options: Options = { out: 'dist', format: 'json', overwrite: false }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--help') {
      console.log(usage)
      Deno.exit(0)
    } else if (arg === '--overwrite') {
      options.overwrite = true
    } else if (arg === '--out') {
      const value = args[++index]
      if (!value) throw new Error('--out requires a directory')
      options.out = value
    } else if (arg === '--format') {
      const value = args[++index]
      if (value !== 'json' && value !== 'csv') {
        throw new Error(\`--format must be json or csv, got '\${value}'\`)
      }
      options.format = value
    } else {
      throw new Error(\`unknown option '\${arg}' — see --help\`)
    }
  }
  return options
}

const rows = [
  { id: 1, name: 'Aster', status: 'active' },
  { id: 2, name: 'Briar', status: 'archived' }
]

const render = (format: Options['format']): string =>
  format === 'json'
    ? JSON.stringify(rows, null, 2)
    : ['id,name,status', ...rows.map(row => \`\${row.id},\${row.name},\${row.status}\`)].join('\\n')

const main = async (): Promise<void> => {
  const options = parseArgs(Deno.args)
  let outExists = false
  try {
    await Deno.stat(options.out)
    outExists = true
  } catch {
    // fresh output directory
  }
  if (outExists && !options.overwrite) {
    console.error(\`refusing to overwrite '\${options.out}' — pass --overwrite to replace it\`)
    Deno.exit(1)
  }
  await Deno.mkdir(options.out, { recursive: true })
  const outPath = \`\${options.out}/export.\${options.format}\`
  await Deno.writeTextFile(outPath, render(options.format))
  console.log(\`wrote \${outPath} (\${rows.length} rows)\`)
}

await main()
`;

const flawedPage = `# Exporting

## Background

The expo tool grew out of our internal reporting pipeline, which
originally wrote everything to a shared network drive. After the
2024 migration we rewrote it in Deno, and it currently lives in
tool/export.ts. The new exporter is much faster and will keep
getting faster as we tune it.

As mentioned above, the tool wants to write your data somewhere, so
it helps to understand its history before running it.

#### Why we picked flat files

We debated a database sink for a long time. Flat files won because
they are easy to diff and easy to ship. A database sink may return
some day.

## Doing an export

It's really easy — you can simply run the tool and it will figure
out the rest.

1. Open a terminal, cd into the project, and run
   \`deno run --allow-read --allow-write tool/export.ts\` to produce
   the export file.
2. The output bundle lands in \`out/\` by default, in CSV format.
3. If the folder already exists, please just pass \`--force\` and the
   tool will happily clobber it for you.
4. You can also change where the artifact goes with \`--out\`.

For more details [click here](https://example.com/expo).
`;

await Deno.mkdir(join(sandbox, "tool"), { recursive: true });
await Deno.mkdir(join(sandbox, "guides"), { recursive: true });
await Deno.writeTextFile(join(sandbox, "tool", "export.ts"), cliSource);
await Deno.writeTextFile(join(sandbox, "guides", "export-data.md"), flawedPage);

const run = async (
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> => {
  const output = await new Deno.Command("deno", {
    args: ["run", "--allow-read", "--allow-write", "tool/export.ts", ...args],
    cwd: sandbox,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
};

// Prove the REAL behavior the rubric depends on.
const help = await run(["--help"]);
if (
  help.code !== 0 || !help.stdout.includes("--overwrite") ||
  !help.stdout.includes("default: dist")
) {
  throw new Error(
    `fixture invalid: help text drifted: ${help.stdout} ${help.stderr}`,
  );
}

const firstRun = await run([]);
if (firstRun.code !== 0) {
  throw new Error(`fixture invalid: default export failed: ${firstRun.stderr}`);
}
const exported = await Deno.readTextFile(join(sandbox, "dist", "export.json"));
if (!exported.includes("Aster")) {
  throw new Error("fixture invalid: dist/export.json missing expected rows");
}

const blockedRun = await run([]);
if (blockedRun.code === 0 || !blockedRun.stderr.includes("--overwrite")) {
  throw new Error(
    "fixture invalid: second run should refuse without --overwrite",
  );
}

const overwriteRun = await run(["--overwrite", "--format", "csv"]);
if (overwriteRun.code !== 0) {
  throw new Error(
    `fixture invalid: --overwrite run failed: ${overwriteRun.stderr}`,
  );
}

// Reset the output tree so the agent starts from a clean sandbox.
await Deno.remove(join(sandbox, "dist"), { recursive: true });

// Prove the faults are planted.
const plantedPage = await Deno.readTextFile(
  join(sandbox, "guides", "export-data.md"),
);
for (
  const fault of ["--force", "`out/`", "simply", "currently", "click here"]
) {
  if (!plantedPage.includes(fault)) {
    throw new Error(
      `fixture invalid: planted fault '${fault}' missing from the flawed page`,
    );
  }
}

console.log("fixture ready: real tool behavior proven, flawed page planted");
