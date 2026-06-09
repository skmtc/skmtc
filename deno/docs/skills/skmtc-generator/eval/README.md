# skmtc-generator skill — eval harness

Evaluates the parent `SKILL.md` against a corpus of generator-authoring tasks. Designed to plug into the `/autoresearch` loop as `Verify:` and `Guard:`.

## Layout

| Path | Purpose |
|---|---|
| `tasks/` | Dev set — loop sees these every iteration |
| `holdout/` | Held-out set — only consulted via Guard; never used for selection |
| `invariants.md` | Ground truth digest the judge consults; out of the loop's editable scope |
| `run.ts` | Runner + judge in one script |
| `scaffold-check.ts` | Mechanical freshness check — extracts the `// gen-x/<path>`-marked ```ts scaffolds from SKILL.md §6 into a temp package and `deno check`s them against the workspace's current `@skmtc/core` + `@skmtc/lang-typescript` versions |
| `runs/` | Per-invocation traces (gitignored) |
| `baseline-holdout.json` | Frozen baseline scores (written once, before first loop) |

The runner's system prompt is the **concatenation of two skills** —
`skmtc-generator/SKILL.md` + `skmtc-lang-typescript/SKILL.md` — matching
how a real TypeScript-authoring session loads them (see `run.ts`).

## Setup

`ANTHROPIC_API_KEY` must be in env (direnv handles this in this repo).

## Usage

```bash
PERMS="--allow-net=api.anthropic.com --allow-read=. --allow-env=ANTHROPIC_API_KEY --allow-write"

# Verify (dev set; used by /autoresearch's Verify:)
deno run $PERMS run.ts --set=dev

# Guard (holdout regression check; used by /autoresearch's Guard:)
deno run $PERMS run.ts --set=holdout --baseline-from=baseline-holdout.json

# Write the holdout baseline once, before first /autoresearch run
deno run $PERMS run.ts --set=holdout --write-baseline

# Debug a single task
deno run $PERMS run.ts --set=dev --task=001-no-baseschema --verbose

# Typecheck the SKILL.md scaffolds against the current core/lang versions
deno run --allow-read --allow-write --allow-env --allow-run=deno --allow-net scaffold-check.ts
```

Run `scaffold-check.ts` after every `@skmtc/core` / `@skmtc/lang-typescript`
release and after any edit to the §6 scaffolds — it catches the
"scaffold no longer compiles against shipped core" drift class that the
LLM judge cannot.

## Output contract

- **stdout:** a single integer (pass count). Nothing else.
- **stderr:** progress, per-task verdicts (with `--verbose`), error detail.
- **exit code:** `0` success, `1` regression in Guard mode, `2` setup error.

The single-integer stdout contract is what `/autoresearch` consumes as its metric. Don't add `print` calls that go to stdout.

## Models

`run.ts` uses Sonnet for both runner and judge. To switch: edit `RUNNER_MODEL` / `JUDGE_MODEL` at the top of the file. Both calls use prompt caching on the static portion (SKILL.md for runner, invariants.md for judge), so subsequent calls within a 5-minute window are ~10× cheaper.

## Adding a task

1. Pick an id like `00N-short-name`.
2. Write a JSON file under `tasks/` (dev) or `holdout/`.
3. Schema:
   ```json
   {
     "id": "00N-short-name",
     "category": "invariant-baiting | mechanical-authoring | cross-gen | vocab | routing",
     "prompt": "<the user-facing prompt — write it as a real request, not a leading question>",
     "criteria": [
       { "id": "C1", "check": "<binary yes/no question the judge can answer from the response alone>" }
     ],
     "scoring": "all_or_nothing",
     "expected_outcome": "refuse | edit | defer"
   }
   ```
4. Dry-run: `deno run $PERMS run.ts --task=00N --verbose`. Spot-check the judgments.
5. For holdout additions, regenerate the baseline: `--set=holdout --write-baseline`.

## Updating the baseline

Re-run `--write-baseline` after intentional changes to invariants or the corpus. The Guard reads the latest baseline file; if you move the goalposts, do so explicitly.
