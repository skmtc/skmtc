#!/usr/bin/env -S deno run --allow-read
/**
 * Mechanical doc/skill-chain sync checks — the regression guard for the
 * drift class the friction reviews keep finding (old C8 → C15: the
 * derivation chain `source → llms.md → SKILL.md → eval corpora` has no
 * sync verification at any link, so each link decays independently).
 *
 * Checks:
 *   1. FACT-LIST SYNC — the skmtc-generator skill's §1 fact list and
 *      llms.md's "Read this first" list have the same item count, and
 *      each header's spelled-out number matches its own list.
 *      (The OTHER skills deliberately tune their own five-fact lists to
 *      their audience — only the generator skill mirrors llms.md.)
 *   2. DEAD-MODEL GUARD — affirmative mentions of the superseded 0.7.x
 *      interim language model (`resolveLang`, the entry `lang` field,
 *      `declares no 'lang'`) are banned across the doc surfaces; a
 *      mention is allowed only on a line that marks it as historical
 *      ("no longer", "deleted", "superseded", …).
 *   3. LANG SOURCE↔SKILL SYNC — for each shipped language layer with a
 *      skill, the type vocabulary count, identifier-factory names, and
 *      value-protocol exports in the lang package must all appear in
 *      its skill. Currently a no-op: every non-TypeScript layer is
 *      pre-alpha and their skills are deleted until they ship.
 *   4. DOCS-WRITING TREE SYNC — the docs-writing skill's §3 Diátaxis
 *      mapping names every content directory that exists on disk, and
 *      authoring/ mirrors using/'s subdirectory trio.
 *   5. FILLER-WORD GUARD — "simply"/"easily"/"obviously"/"as of this
 *      writing" (banned by docs-writing §4) must not appear in the
 *      reader-facing tree (using/authoring/reference/concepts/
 *      explanation).
 *   6. CLI COMMAND-SURFACE SYNC — every top-level command registered
 *      in cli/mod.ts is mentioned in the skmtc-cli skill and has a
 *      reference/cli/<command>.md page; every reference/cli page and
 *      every row of the skill's command table names a command that is
 *      still registered.
 *   7. PARSE-ISSUE SYNC — every member of the OasIssueType and
 *      GqlIssueType unions has a `### \`CODE\`` entry in
 *      reference/error-codes.md, every documented code is still in a
 *      union, and every issue level the source emits is documented.
 *   8. CLIENT-SETTINGS SYNC — every key of the clientSettings and
 *      skmtcClientConfig valibot schemas appears in
 *      reference/settings/client-json-schema.md (the page claims
 *      "the complete shape").
 *
 *   exit 0 — all checks hold.
 *   exit 1 — one or more failed; each failure names file + expectation.
 *
 * Usage:  deno run --allow-read deno/docs/verify-docs.ts
 * Companion: `friction-log/verify-catalog.ts` (re-runs the discrepancy
 * catalog's pinned verification commands). CI runs both via
 * `deno task verify-docs`.
 */

import { dirname, fromFileUrl, join } from "jsr:@std/path@^1";

const docsDir = dirname(fromFileUrl(import.meta.url));
const denoDir = join(docsDir, "..");

let failures = 0;

const fail = (message: string): void => {
  failures++;
  console.log(`FAIL  ${message}`);
};

const pass = (message: string): void => {
  console.log(`ok    ${message}`);
};

const numberWords: Record<number, string> = {
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
};

// ---------------------------------------------------------------------
// 1. Fact-list sync: skmtc-generator SKILL.md §1 ↔ llms.md "Read this
//    first". Counts must match, and each header's spelled number must
//    match its own list length.
// ---------------------------------------------------------------------

type FactList = { headerWord: string | undefined; count: number };

const parseFactList = (
  text: string,
  headerPattern: RegExp,
): FactList | undefined => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => headerPattern.test(line));

  if (start === -1) {
    return undefined;
  }

  const headerWord = lines[start].match(
    new RegExp(`(${Object.values(numberWords).join("|")}) facts`, "i"),
  )?.[1]?.toLowerCase();

  let count = 0;
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    if (/^\d+\. \*\*/.test(line)) count++;
  }

  return { headerWord, count };
};

const llmsPath = join(docsDir, "llms.md");
const generatorSkillPath = join(
  docsDir,
  "skills",
  "skmtc-generator",
  "SKILL.md",
);

const llmsFacts = parseFactList(
  await Deno.readTextFile(llmsPath),
  /^## Read this first/,
);
const skillFacts = parseFactList(
  await Deno.readTextFile(generatorSkillPath),
  /^## 1\. The \w+ facts/,
);

if (!llmsFacts) {
  fail('llms.md: "Read this first" section not found');
} else if (!skillFacts) {
  fail('skmtc-generator SKILL.md: "§1 The <n> facts" section not found');
} else {
  if (llmsFacts.count !== skillFacts.count) {
    fail(
      `fact-list drift: llms.md has ${llmsFacts.count} facts, ` +
        `skmtc-generator SKILL.md §1 has ${skillFacts.count} — re-sync them ` +
        `(the generator skill mirrors llms.md; the other skills tune their own lists)`,
    );
  } else {
    pass(
      `fact-list sync: llms.md and generator skill both list ${llmsFacts.count} facts`,
    );
  }

  for (
    const [name, facts] of [
      ["llms.md", llmsFacts],
      ["skmtc-generator SKILL.md", skillFacts],
    ] as const
  ) {
    const expected = numberWords[facts.count];
    if (facts.headerWord !== expected) {
      fail(
        `${name}: header says "${
          facts.headerWord ?? "<no number word>"
        } facts" ` +
          `but the list has ${facts.count} items (expected "${expected}")`,
      );
    } else {
      pass(`${name}: header word matches list length`);
    }
  }
}

// ---------------------------------------------------------------------
// 2. Dead-model guard: the 0.7.x interim language model must not be
//    described affirmatively anywhere agents read. Mentions are fine on
//    lines that mark the model as historical.
// ---------------------------------------------------------------------

const deadModelPatterns: { name: string; pattern: RegExp }[] = [
  { name: "resolveLang", pattern: /resolveLang/ },
  { name: "engine-start lang error", pattern: /declares no 'lang'/ },
  { name: "required lang field", pattern: /required\*?\*? `lang` field/ },
  {
    name: "lang declared on the entry",
    pattern: /entry declares (?:a|the generator's) `?lang`?/,
  },
  {
    name: "lang resolved by generatorId",
    pattern: /resolv\w+ (?:it|the language) by `?generatorId`?/,
  },
];

const historicalMarkers =
  /no longer|deleted|superseded|unwound|there is no|gone|incorrect|pre-0\.8|0\.7\.x|interim|historical|was the/i;

const surfaceFiles: string[] = [llmsPath];

const collect = async (dir: string, suffixes: string[]): Promise<void> => {
  for await (const entry of Deno.readDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory) {
      await collect(path, suffixes);
    } else if (suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      surfaceFiles.push(path);
    }
  }
};

await collect(join(docsDir, "concepts"), [".md"]);
await collect(join(docsDir, "reference"), [".md"]);
for await (const entry of Deno.readDir(join(docsDir, "skills"))) {
  if (!entry.isDirectory) continue;
  const skillFile = join(docsDir, "skills", entry.name, "SKILL.md");
  try {
    await Deno.stat(skillFile);
    surfaceFiles.push(skillFile);
  } catch {
    // skill dir without SKILL.md — nothing to check
  }
}
let deadModelHits = 0;
for (const file of surfaceFiles) {
  const lines = (await Deno.readTextFile(file)).split("\n");
  lines.forEach((line, index) => {
    for (const { name, pattern } of deadModelPatterns) {
      if (pattern.test(line) && !historicalMarkers.test(line)) {
        deadModelHits++;
        fail(
          `dead-model claim (${name}) without a historical marker: ` +
            `${file.replace(denoDir + "/", "")}:${index + 1}`,
        );
      }
    }
  });
}
if (deadModelHits === 0) {
  pass(
    `dead-model guard: no affirmative 0.7.x interim-model claims across ${surfaceFiles.length} files`,
  );
}

// ---------------------------------------------------------------------
// 3. lang-<X> source ↔ skill sync — one block per shipped language.
// ---------------------------------------------------------------------

// Empty while every non-TypeScript language layer is pre-alpha: their
// skills were deleted (2026-07-07) and will be recreated — one entry
// here per language — when a layer ships and its skill returns.
const languageSyncTargets: {
  packageDirectory: string;
  skillName: string;
  guardPrefix: string;
}[] = [];

for (
  const { packageDirectory, skillName, guardPrefix } of languageSyncTargets
) {
  const skillPath = join(docsDir, "skills", skillName, "SKILL.md");
  const skill = await Deno.readTextFile(skillPath);
  const factories = await Deno.readTextFile(
    join(denoDir, packageDirectory, "src", "createIdentifier.ts"),
  );
  const packageMod = await Deno.readTextFile(
    join(denoDir, packageDirectory, "mod.ts"),
  );

  const factoryNames = [
    ...new Set(
      [...factories.matchAll(/export const (create[A-Z]\w+)/g)].map((m) =>
        m[1]
      ),
    ),
  ];

  const kindWord = numberWords[factoryNames.length];
  if (!skill.includes(`${kindWord} entity kinds`)) {
    fail(
      `${skillName} SKILL.md: expected "${kindWord} entity kinds" ` +
        `(${packageDirectory} exports ${factoryNames.length} identifier factories: ${
          factoryNames.join(", ")
        })`,
    );
  } else {
    pass(
      `${packageDirectory} type vocabulary: skill says "${kindWord} entity kinds" matching ${factoryNames.length} factories`,
    );
  }

  for (const factory of factoryNames) {
    if (!skill.includes(factory)) {
      fail(
        `${skillName} SKILL.md: identifier factory ${factory} is exported but never mentioned`,
      );
    }
  }

  const guardPattern = new RegExp(`\\b(${guardPrefix}[A-Z]\\w+)`, "g");
  const protocolGuards = [
    ...new Set([...packageMod.matchAll(guardPattern)].map((m) => m[1])),
  ];
  for (const guard of protocolGuards) {
    if (!skill.includes(guard)) {
      fail(
        `${skillName} SKILL.md: value-protocol guard ${guard} is exported but never mentioned`,
      );
    }
  }
  if (protocolGuards.every((guard) => skill.includes(guard))) {
    pass(
      `${packageDirectory} protocols: all ${protocolGuards.length} exported guards (${
        protocolGuards.join(", ")
      }) appear in the skill`,
    );
  }
}

// ---------------------------------------------------------------------
// 4. Docs-writing tree sync — the docs-writing skill's §3 parenthetical
//    maps Diátaxis onto this tree's directory names. The v0.1.0 mapping
//    had already drifted (recipes/ existed but wasn't mentioned), so
//    both directions are checked: every content directory on disk is
//    named in the skill, and authoring/ mirrors using/'s trio (the
//    skill claims "same trio").
// ---------------------------------------------------------------------

const docsWritingSkillPath = join(
  docsDir,
  "skills",
  "docs-writing",
  "SKILL.md",
);
const docsWritingSkill = await Deno.readTextFile(docsWritingSkillPath);

const listSubdirectories = async (dir: string): Promise<string[]> => {
  const names: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isDirectory) names.push(entry.name);
  }
  return names.sort();
};

const usingSubdirectories = await listSubdirectories(join(docsDir, "using"));
const authoringSubdirectories = await listSubdirectories(
  join(docsDir, "authoring"),
);

let treeSyncFailures = 0;

for (const name of usingSubdirectories) {
  if (!docsWritingSkill.includes(`using/${name}/`)) {
    treeSyncFailures++;
    fail(
      `docs-writing SKILL.md: docs/using/${name}/ exists but the §3 tree mapping doesn't name \`using/${name}/\``,
    );
  }
}

if (usingSubdirectories.join(",") !== authoringSubdirectories.join(",")) {
  treeSyncFailures++;
  fail(
    `docs-writing SKILL.md claims authoring/ mirrors using/'s trio, but ` +
      `using/ has [${usingSubdirectories.join(", ")}] and authoring/ has [${
        authoringSubdirectories.join(", ")
      }]`,
  );
}

for (const name of ["authoring/", "reference/", "concepts/", "explanation/"]) {
  if (!docsWritingSkill.includes(`\`${name}\``)) {
    treeSyncFailures++;
    fail(`docs-writing SKILL.md: §3 tree mapping doesn't name \`${name}\``);
  }
}

if (treeSyncFailures === 0) {
  pass(
    `docs-writing tree sync: skill names all ${usingSubdirectories.length} using/ subdirectories ` +
      `+ the top-level content dirs; authoring/ mirrors using/`,
  );
}

// ---------------------------------------------------------------------
// 5. Filler-word guard — the docs-writing skill (§4) bans "simply",
//    "easily", "obviously", and "as of this writing" as filler that
//    condescends when the step isn't easy for the reader. Enforced
//    zero-tolerance across the reader-facing tree. Deliberately NOT
//    checked: "just" and "currently" — both have too many legitimate
//    uses here ("just-in-time", version-scoped capability statements
//    like "does not currently retry"); those stay a review concern.
//    skills/ is excluded: the docs-writing skill quotes the banned
//    words as counter-examples.
// ---------------------------------------------------------------------

const fillerPattern = /\b(simply|easily|obviously)\b|as of this writing/i;

const readerFacingFiles: string[] = [];
for (
  const dir of ["using", "authoring", "reference", "concepts", "explanation"]
) {
  const collectMarkdown = async (root: string): Promise<void> => {
    for await (const entry of Deno.readDir(root)) {
      const path = join(root, entry.name);
      if (entry.isDirectory) await collectMarkdown(path);
      else if (entry.name.endsWith(".md")) readerFacingFiles.push(path);
    }
  };
  await collectMarkdown(join(docsDir, dir));
}

let fillerHits = 0;
for (const file of readerFacingFiles) {
  const lines = (await Deno.readTextFile(file)).split("\n");
  lines.forEach((line, index) => {
    const match = line.match(fillerPattern);
    if (match) {
      fillerHits++;
      fail(
        `filler word "${match[0]}" (banned by docs-writing §4): ` +
          `${file.replace(denoDir + "/", "")}:${index + 1}`,
      );
    }
  });
}
if (fillerHits === 0) {
  pass(
    `filler-word guard: no simply/easily/obviously across ${readerFacingFiles.length} reader-facing files`,
  );
}

// ---------------------------------------------------------------------
// 6. CLI command-surface sync — cli/mod.ts is the source of truth for
//    the registered command surface. Registrations before the final
//    `await new Command()` chain are nested subcommands (project
//    create/rm, migrate variants); registrations after it are the
//    top-level surface. Both the skmtc-cli skill and the per-command
//    reference pages must track it, in both directions.
// ---------------------------------------------------------------------

const cliModText = await Deno.readTextFile(join(denoDir, "cli", "mod.ts"));
const rootChainIndex = cliModText.indexOf("await new Command()");

const commandRegistrations = [
  ...cliModText.matchAll(/\.command\('([a-z][a-z-]*)', \w+Command\)/g),
];
const topLevelCommands = commandRegistrations
  .filter((match) => (match.index ?? 0) > rootChainIndex)
  .map((match) => match[1]);

if (rootChainIndex === -1 || topLevelCommands.length === 0) {
  fail(
    "cli/mod.ts: could not locate the root `await new Command()` chain — " +
      "the command-surface parser needs updating",
  );
} else {
  const cliSkillText = await Deno.readTextFile(
    join(docsDir, "skills", "skmtc-cli", "SKILL.md"),
  );

  let commandSurfaceFailures = 0;

  for (const command of topLevelCommands) {
    if (!cliSkillText.includes("`" + command)) {
      commandSurfaceFailures++;
      fail(
        `skmtc-cli SKILL.md: registered command \`${command}\` is never mentioned`,
      );
    }

    try {
      await Deno.stat(join(docsDir, "reference", "cli", `${command}.md`));
    } catch {
      commandSurfaceFailures++;
      fail(
        `reference/cli/${command}.md: registered command \`${command}\` has no reference page`,
      );
    }
  }

  for await (const entry of Deno.readDir(join(docsDir, "reference", "cli"))) {
    if (
      !entry.name.endsWith(".md") ||
      entry.name === "overview.md" ||
      entry.name === "CLAUDE.md"
    ) continue;
    const documented = entry.name.replace(/\.md$/, "");
    if (!topLevelCommands.includes(documented)) {
      commandSurfaceFailures++;
      fail(
        `reference/cli/${entry.name}: documents \`${documented}\`, which is not ` +
          `a registered top-level command in cli/mod.ts`,
      );
    }
  }

  const commandTableSection = cliSkillText.match(
    /^## \d+\. Command surface[\s\S]*?(?=^## )/m,
  );
  if (!commandTableSection) {
    commandSurfaceFailures++;
    fail('skmtc-cli SKILL.md: "Command surface" section not found');
  } else {
    for (
      const row of commandTableSection[0].matchAll(/^\| `([a-z][a-z-]*)/gm)
    ) {
      if (!topLevelCommands.includes(row[1])) {
        commandSurfaceFailures++;
        fail(
          `skmtc-cli SKILL.md command table: \`${row[1]}\` is not a registered ` +
            `top-level command in cli/mod.ts`,
        );
      }
    }
  }

  if (commandSurfaceFailures === 0) {
    pass(
      `CLI command-surface sync: all ${topLevelCommands.length} registered commands ` +
        `are in the skill + have reference pages; no stale entries`,
    );
  }
}

// ---------------------------------------------------------------------
// 7. Parse-issue sync — the OasIssueType and GqlIssueType unions are
//    the source of truth for issue codes; the levels the source emits
//    are the source of truth for severity levels. error-codes.md
//    claims to be the canonical catalog, so both directions must hold.
// ---------------------------------------------------------------------

const parseUnionMembers = (text: string, typeName: string): string[] => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) =>
    line.startsWith(`export type ${typeName} =`)
  );
  if (start === -1) return [];

  const members: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const member = line.match(/^\s*\| '([A-Z_]+)'/);
    if (!member) break;
    members.push(member[1]);
  }
  return members;
};

const oasIssueMembers = parseUnionMembers(
  await Deno.readTextFile(join(denoDir, "core", "context", "generateTypes.ts")),
  "OasIssueType",
);
const parseIssueText = await Deno.readTextFile(
  join(denoDir, "core", "context", "ParseIssue.ts"),
);
const gqlIssueMembers = parseUnionMembers(parseIssueText, "GqlIssueType");

const errorCodesText = await Deno.readTextFile(
  join(docsDir, "reference", "error-codes.md"),
);

if (oasIssueMembers.length === 0 || gqlIssueMembers.length === 0) {
  fail(
    "issue-type unions: could not parse OasIssueType or GqlIssueType from " +
      "core — the union parser needs updating",
  );
} else {
  let issueSyncFailures = 0;
  const unionMembers = new Set([...oasIssueMembers, ...gqlIssueMembers]);

  for (const code of unionMembers) {
    if (!errorCodesText.includes(`### \`${code}\``)) {
      issueSyncFailures++;
      fail(
        `reference/error-codes.md: issue type ${code} is in the source union ` +
          `but has no \`### ${code}\` entry`,
      );
    }
  }

  for (const heading of errorCodesText.matchAll(/^### `([A-Z_]+)`/gm)) {
    if (!unionMembers.has(heading[1])) {
      issueSyncFailures++;
      fail(
        `reference/error-codes.md: documents ${heading[1]}, which is in ` +
          `neither OasIssueType nor GqlIssueType`,
      );
    }
  }

  const sourceLevels = [
    ...new Set(
      [...parseIssueText.matchAll(/level: '(\w+)'/g)].map((match) => match[1]),
    ),
  ];
  const levelsSection = errorCodesText.match(
    /^## Issue levels[\s\S]*?(?=^## )/m,
  );
  for (const level of sourceLevels) {
    if (!levelsSection || !levelsSection[0].includes(`\`${level}\``)) {
      issueSyncFailures++;
      fail(
        `reference/error-codes.md "Issue levels": source emits level '${level}' ` +
          `(core/context/ParseIssue.ts) but the section doesn't document it`,
      );
    }
  }

  if (issueSyncFailures === 0) {
    pass(
      `parse-issue sync: all ${unionMembers.size} issue codes and ` +
        `${sourceLevels.length} levels match error-codes.md, no stale entries`,
    );
  }
}

// ---------------------------------------------------------------------
// 8. Client-settings sync — the clientSettings and skmtcClientConfig
//    valibot schemas in core/types/Settings.ts define the client.json
//    surface. reference/settings/client-json-schema.md claims "the
//    complete shape", so every schema key must appear there (as a
//    `"key"` in a JSONC block or as backticked prose).
// ---------------------------------------------------------------------

const parseSchemaKeys = (text: string, constName: string): string[] => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) =>
    line.startsWith(`export const ${constName}`)
  );
  if (start === -1) return [];

  const keys: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\}\)/.test(line)) break;
    const key = line.match(/^  (\w+):/);
    if (key) keys.push(key[1]);
  }
  return keys;
};

const settingsText = await Deno.readTextFile(
  join(denoDir, "core", "types", "Settings.ts"),
);
const clientJsonDocText = await Deno.readTextFile(
  join(docsDir, "reference", "settings", "client-json-schema.md"),
);

const settingsKeys = parseSchemaKeys(settingsText, "clientSettings");
const configKeys = parseSchemaKeys(settingsText, "skmtcClientConfig");

if (settingsKeys.length === 0 || configKeys.length === 0) {
  fail(
    "core/types/Settings.ts: could not parse clientSettings or " +
      "skmtcClientConfig keys — the schema parser needs updating",
  );
} else {
  let settingsSyncFailures = 0;
  for (
    const [owner, keys] of [
      ["clientSettings", settingsKeys],
      ["skmtcClientConfig", configKeys],
    ] as const
  ) {
    for (const key of keys) {
      const documented = clientJsonDocText.includes(`"${key}"`) ||
        clientJsonDocText.includes(`\`${key}\``) ||
        clientJsonDocText.includes(`.${key}\``);
      if (!documented) {
        settingsSyncFailures++;
        fail(
          `reference/settings/client-json-schema.md: ${owner} key ` +
            `\`${key}\` (core/types/Settings.ts) is not documented`,
        );
      }
    }
  }

  if (settingsSyncFailures === 0) {
    pass(
      `client-settings sync: all ${settingsKeys.length + configKeys.length} ` +
        `schema keys appear in client-json-schema.md`,
    );
  }
}

// ---------------------------------------------------------------------

console.log(
  `\n${
    failures === 0
      ? "All doc-sync checks hold."
      : `${failures} check(s) failed.`
  }`,
);
Deno.exit(failures > 0 ? 1 : 0);
