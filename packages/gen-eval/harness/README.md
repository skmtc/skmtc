# gen-kotlin-jackson authoring harness

Runs a model against the "author `gen-kotlin-jackson` from scratch"
task in a fresh, isolated SKMTC workspace, captures everything needed
for diagnosis, and grades the result with ground-truth gates plus the
structural eval. You are the judge; the harness makes each attempt
cheap, reproducible, and comparable.

## Run it

```bash
cd skmtc/packages/gen-eval
harness/run.sh claude-fable-5              # or: sonnet | opus | haiku
harness/run.sh sonnet after-skill-fix      # optional label for the run
```

Requirements: `skmtc` CLI on PATH, `claude` CLI, node ≥ 23, gradle +
a JDK (homebrew `openjdk@21` is auto-detected). The harness is
all-node — no python dependency.

**The dashboard** (`node harness/server.js`, auto-started by run.sh)
serves everything at `http://127.0.0.1:8484`: a run list with LIVE /
done / aborted status, verdicts, gates, cost — and each run's viewer
at `/runs/<id>/viewer.html`, which live-follows an in-flight run
(polls the transcript every ~3s; tails the newest turn unless you
scrub back). The link prints BEFORE the model starts. Do not edit
harness scripts while a run is in flight — bash reads them lazily. The run uses
`--dangerously-skip-permissions`, scoped to the throwaway workspace.
A run typically takes 10–40 minutes depending on the model.

## What a run produces — `harness/runs/<id>/`

While a run is live, the terminal shows **one line per action** (tool
calls, errors, milestones like "loaded skmtc-generator skill" /
"generator src/base.ts written" / "clean generate" / "gradle BUILD
SUCCESSFUL"), stamped with elapsed time and turn number. The same feed
is written to `timeline.md` — from another terminal:
`tail -f harness/runs/<id>/timeline.md`. Post-hoc, re-render any
transcript with `node harness/timeline.js <transcript.jsonl>`.

| File | What it is |
|---|---|
| `report.md` | The gates table + structural verdict — **read this first** |
| `viewer.html` | **In-browser scrubber** — open it and drag through the run turn by turn (see below) |
| `timeline.md` | Turn-by-turn progress: milestones, tool calls, errors — the skim view |
| `structural.md` / `.json` | The 14-check structural eval over the authored generator |
| `transcript.jsonl` | Full stream-json transcript incl. thinking and every tool call |
| `session.jsonl` | The Claude Code session file (same content, session format) |
| `meta.json` | Model, skill git SHA (+dirty flag), cost, turns, duration |
| `skill-snapshot/` | Copy of the skmtc-generator skill as it was for this run |
| `workspace/` | The full sandbox: authored generator at `workspace/.skmtc/lab/gen-kotlin-jackson/`, generated Kotlin at `workspace/consumer/src/main/kotlin/models/` |
| `generate.json`, `compile.log`, `test.log`, `integrity.log` | Raw gate evidence |
| `runs/index.jsonl` | One line per run — model, skill SHA, gates, verdict, cost |

## Isolation and cross-run contamination

Each run's workspace is created in a fresh temp dir **outside every
repo** (copied into the run dir at the end): no project `CLAUDE.md`
ancestors load, per-run project memory is fresh (keyed by cwd), there
are no sibling runs to browse, and the sandbox contains no path hints
to existing generator implementations. Three layers keep the task
honest under `--dangerously-skip-permissions`:

1. **Isolation** — the temp workspace above.
2. **Declaration** — the workspace's `.claude/settings.json` carries
   deny rules for the stock generators, demo apps, `.skmtc` projects,
   and previous runs; `task.md` states the hard rules.
3. **Audit (the real enforcement)** — the `contamination` gate scans
   every tool-call input in the transcript for forbidden paths and
   FAILs the run on any hit. Bash can physically read anything under
   skip-permissions; it cannot do so *unrecorded*.

Deliberately shared across runs (constants, recorded per run):
`~/.claude/CLAUDE.md` + user skills (the skill under test — SHA and a
snapshot captured in the run dir), and the gradle/deno/pnpm caches
(dependency bytes, not knowledge).

## The run viewer

`open harness/runs/<id>/viewer.html` — a self-contained page (no
server, works offline) with a video-player scrubber over the run:

- drag the playhead, click the track, use ◀ ▶ / arrow keys, or press
  play to replay the run turn by turn (space = play/pause; play at the
  end restarts from turn 1)
- green ticks mark milestones, red ticks mark turns with tool errors
- left pane: the selected turn — thinking (collapsible), assistant
  text, every tool call with inputs, Write contents, Edit diffs, and
  results (errors auto-expanded)
- right pane: the **workspace as of that turn** — files reconstructed
  by replaying Write/Edit operations, so you can watch `base.ts`
  evolve; `*` marks files touched in the current turn

Regenerate for any run with `node harness/viewer.js <run-dir>`;
`node harness/viewer.js --template standalone.html` builds a
drag-and-drop version that opens any `transcript.jsonl`.

## The gates (ground truth, no judging)

0. **contamination** — no tool call touched other generator
   implementations, demo apps, or previous runs (transcript audit)
1. **integrity** — acceptance tests / build files / schema untouched
   (checksums; edits disqualify the run)
2. **generate** — `skmtc clean` + `generate` from the bundle exits
   clean (also catches hand-written output masquerading as generated)
3. **schema-coverage** — one Kotlin file per `components.schemas` entry
4. **compile** — `gradle compileKotlin`
5. **round-trip** — the pinned Jackson tests: snake_case fidelity, the
   `object` keyword property, enum, and `petType`-discriminated
   `Animal` polymorphism

Then the structural eval runs over the authored generator — target
trajectory: `FAIL(1F+10W)` (the existing sub-par implementation's
signature) → `clean`.

## The diagnose → fix → re-run loop

1. Read `report.md`, then `structural.md` for which rules were broken.
2. Mine `transcript.jsonl` for *where* it went wrong: did it load the
   skill? (search `"skmtc-generator"`), what did it write first?
   (search `base.ts`), did it loop on an error? (search the error
   text). Thinking blocks show the reasoning that preceded a wrong
   turn.
3. Map the failure to a skill section, edit the skill
   (`skmtc/deno/docs/skills/skmtc-generator/SKILL.md`), run
   `deno task verify-docs` in `skmtc/deno`.
4. Re-run with a label: `harness/run.sh <model> after-<fix>`.
5. Compare: `column -t -s'|' <(jq -r '[.run,.model,.skillSha,.gatesPass,.structural,.warnings,.costUsd]|@tsv' runs/index.jsonl)` —
   or just `cat harness/runs/index.jsonl`.

Caution: single runs are noisy. A gate flipping on one run is weak
evidence a skill edit worked — when it matters, run 2–3 per
configuration and read the transcripts, not just the counts.

## Notes

- The workspace contains no other generator implementations — the
  model cannot peek at the existing sub-par `gen-kotlin-jackson-s`.
- `lang-kotlin` is vendored from `skmtc/deno/lang-kotlin` at seed time,
  so runs pick up the current lang-package state; the skill SHA in
  `meta.json` pins what guidance the model had.
- Baseline for comparison: `pnpm stock` — the same structural eval over
  the whole stock fleet.
