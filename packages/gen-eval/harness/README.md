# gen-kotlin-jackson authoring harness

Runs a model against the task "author `gen-kotlin-jackson` from
scratch" in a fresh, isolated SKMTC workspace; captures everything
needed for diagnosis (full transcript, live timeline, scrubber viewer,
workspace snapshot, provenance); grades the result with ground-truth
gates plus the [structural eval](../docs/README.md).

The design philosophy, agreed after this project's earlier LLM-judge
evals were retired as unconvincing: **automation only where it is
ground truth** (does it bundle, generate, compile, round-trip; is the
source shaped like a producer), **the human is the judge** of quality.
The harness's job is to make each attempt cheap, reproducible, and
comparable — and to make your review fast.

---

## Quick start

```bash
cd skmtc/packages/gen-eval
harness/run.sh claude-fable-5              # model is the one required arg
harness/run.sh sonnet after-skill-fix      # optional label tags the config

# dial reasoning up/down (recorded in meta.json):
MAX_THINKING_TOKENS=32000 harness/run.sh claude-fable-5 deep-think
MAX_THINKING_TOKENS=2048  harness/run.sh sonnet shallow-think

# dashboard on a different port:
GEN_EVAL_PORT=9000 harness/run.sh sonnet
```

**Requirements:** `skmtc` CLI on PATH, `claude` CLI, node ≥ 23,
gradle + a JDK (homebrew `openjdk@21` is auto-detected and wired via
`gradle.properties`). The harness is all-node — no python dependency.

A run typically takes 10–40 minutes depending on the model. The run
uses `--dangerously-skip-permissions`, scoped to a throwaway
workspace (see Isolation below).

**Billing:** runs go through the `claude` CLI with whatever auth your
terminal has. Subscription login → runs draw from your plan's usage
windows (no separate charge; the `$` figures in meta/dashboard are
notional API-equivalents for comparing runs). `ANTHROPIC_API_KEY`
exported → true pay-per-token API billing, and your interactive
capacity is untouched.

**Do not edit harness scripts while a run is in flight** — bash reads
scripts lazily, and a mid-flight edit can corrupt the run's
post-processing.

---

## What happens during a run

`run.sh <model> [label]` executes this pipeline:

1. **Seed** (`seed.sh`) — creates a fresh workspace in a temp dir
   *outside every repo*: `skmtc init lab`, the pinned schema
   (`assets/openapi.json`), `@skmtc/lang-kotlin` vendored from
   `skmtc/deno/lang-kotlin` as a deno workspace member, and the
   consumer gradle app with the pinned acceptance tests. Integrity
   checksums are recorded.
2. **Deny rules** — the workspace's `.claude/settings.json` declares
   the stock generators, demo apps, and previous runs off-limits.
3. **Provenance** — `meta.json` records model, label, skill git SHA
   (+ dirty-file count), thinking budget, start time; the
   skmtc-generator skill is snapshotted into the run dir.
4. **Dashboard + live viewer** — the dashboard is started if not
   already running and the run's live-viewer URL is printed *before*
   the model starts.
5. **The authoring run** — `claude -p` with the contents of
   [`task.md`](task.md), streaming `stream-json`. The stream is teed
   to `transcript.jsonl` and through `timeline.js`, which prints one
   line per action to your terminal and writes `timeline.md`.
6. **Post-run capture** — the Claude Code session file is copied in;
   cost/turns/duration are extracted from the stream's result event
   into `meta.json`.
7. **Gates** (`gates.sh`) — see below; also runs the structural eval
   over the authored generator and writes `report.md`.
8. **Archive** — the temp workspace is copied to
   `runs/<id>/workspace/` and the temp dir deleted; the viewer is
   re-baked as a static self-contained file; the run is appended to
   `runs/index.jsonl`; clickable links are printed.

---

## Following along

Three synchronized views while a run is live:

- **Terminal** — one line per action with elapsed time and turn
  number; milestones and errors surface inline.
- **Dashboard** — `http://127.0.0.1:8484/` lists every run with
  status (**LIVE** / done / **aborted** — aborted = no result event
  and the transcript quiet for 5 minutes), verdict, gates, turns,
  cost, and skill SHA. Auto-refreshes.
- **Live viewer** — `http://127.0.0.1:8484/runs/<id>/viewer.html`
  polls the transcript every ~3 s. It *tails* the newest turn while
  you're at the end and *holds your position* if you've scrubbed
  back.

### Milestones

Detected in `timeline.js` and the viewer (green ticks on the scrubber
track); each fires once, on first occurrence:

| Milestone | Trigger |
|---|---|
| `loaded <skill> skill` | Skill tool call whose name contains `skmtc` (fires per skill — generator, cli, …) |
| `generator src/base.ts written` | Write/Edit — or a bash heredoc — targeting `src/base.ts` under a `gen-*` path |
| `generator src/mod.ts written` | same, for `src/mod.ts` |
| `generator src/enrichments.ts written` | same, for `src/enrichments.ts` |
| `first bundle attempt` | Bash command containing `skmtc bundle` |
| `first generate attempt` | Bash command containing `skmtc generate` |
| `first test attempt` | Bash command containing `gradle test` |
| `clean generate` | a tool result containing `"type": "generated"` with `"errors": []` |
| `gradle BUILD SUCCESSFUL` | a tool result containing `BUILD SUCCESSFUL` |
| `run finished — turns/cost` | the stream's result event (viewer only) |

Together they trace the intended arc: skills → the three generator
files → bundle → generate → clean generate → tests green. A run whose
timeline never reaches `src/base.ts written` (e.g. a research spiral)
is diagnosable at a glance. To add a milestone, edit the
`MILESTONE_FILES` / `MILESTONE_CMDS` constants in `timeline.js` and
`viewer.template.html` (kept in sync by hand).

### The run viewer

A video-player scrubber over the run (the same page works live over
the dashboard and as the static archived file):

- **Scrubber track**: drag the playhead, click to seek, ◀ ▶ buttons,
  arrow keys; space = play/pause at ~1 turn/s (play at the end
  replays from turn 1). Green ticks mark milestones, red ticks mark
  turns with tool errors.
- **Turn pane** (left): milestones, thinking markers, assistant text,
  every tool call with inputs (Write contents, Edit diffs, Bash
  commands), and results — errors auto-expanded. Disclosure state and
  scroll survive live updates and scrubbing.
- **Workspace pane** (right): a collapsible **file tree** plus a
  line-numbered **code view** showing the workspace *as of the
  scrubbed turn*, reconstructed by replaying Write/Edit operations
  and bash heredoc writes (`cat > file <<'EOF'`). Files touched in
  the current turn are marked `*`.

**Thinking is redacted by the platform.** For current models the
Anthropic API defaults to `display: "omitted"` — thinking blocks
arrive empty (signature only) in every Claude Code surface, headless
and interactive, regardless of auth (upstream:
anthropics/claude-code#36006). The viewer and timeline therefore show
`thinking — redacted by API (~N tokens)` using the streamed token
estimates; if a model/config ever ships plaintext, the full
collapsible reasoning appears automatically. `MAX_THINKING_TOKENS`
still controls how much reasoning *happens*.

Post-hoc tooling: `node harness/viewer.js <run-dir>` re-bakes a
static viewer; `node harness/viewer.js --template out.html` builds a
drag-and-drop page that opens any transcript;
`node harness/timeline.js <transcript.jsonl>` re-renders a timeline.

---

## The task given to the model

[`task.md`](task.md) is passed verbatim as the prompt. Its deliberate
calibration:

- **Skill loading is instructed, not discovered** — the eval measures
  whether the *skill teaches the shape*, not whether the model finds
  the skill.
- **The acceptance test is the spec** — class names, package,
  snake_case fidelity, the `object` hard-keyword property, and
  `petType` polymorphism are all defined by `RoundTripTest.kt`, which
  the model is told to read.
- **lang-kotlin is pointed at, not taught** — pre-alpha, no skill;
  "read its source" tests the skmtc-generator skill's §8 strategy for
  new languages.
- **Hard rules name the enforcement** — tests are checksum-verified;
  copying from other implementations is audited.

To run variants (e.g. drop the skill-loading instruction), edit
`task.md` and tag the run with a label; the prompt is in git, so
variants stay reconstructable.

Beyond the prompt, the model gets: the standard Claude Code system
prompt, the user-global `~/.claude/CLAUDE.md` (a constant across
runs), and the user-level skills. No project CLAUDE.md loads (the
workspace is outside every repo) and per-run project memory starts
empty.

---

## What a run produces — `runs/<id>/`

| File | What it is |
|---|---|
| `report.md` | Gates table + structural verdict — **read this first** |
| `viewer.html` | The scrubber viewer (live during the run, static after) |
| `timeline.md` | Turn-by-turn skim view: milestones, tool calls, errors |
| `structural.md` / `.json` | The structural eval (all checks + aggregate verdict) over the authored generator |
| `transcript.jsonl` | Full stream-json feed: every tool call, every event |
| `session.jsonl` | The Claude Code session file (backup capture) |
| `meta.json` | Model, label, skill SHA + dirty flag, thinking budget, cost, turns, duration |
| `skill-snapshot/` | The skmtc-generator skill exactly as this run saw it |
| `workspace/` | The full sandbox: authored generator at `.skmtc/lab/gen-kotlin-jackson/`, generated Kotlin at `consumer/src/main/kotlin/models/` |
| `generate.json`, `compile.log`, `test.log`, `integrity.log` | Raw gate evidence |
| `../index.jsonl` | One line per run: model, skill SHA, gates, verdict, cost, turns |

---

## The gates (ground truth, no judging)

0. **contamination** — no tool-call input touched other generator
   implementations, demo apps, or previous runs (transcript audit).
1. **integrity** — acceptance tests / build files / schema untouched
   (checksums; edits disqualify the run).
2. **generate** — `skmtc clean` + `skmtc generate` from the bundle
   exits with no errors (also catches hand-written output
   masquerading as generated: clean deletes it, generate must
   recreate it).
3. **schema-coverage** — one Kotlin file per `components.schemas`
   entry.
4. **compile** — `gradle compileKotlin` (skipped with a note if no
   JDK/gradle).
5. **round-trip** — the pinned Jackson tests: JSON tree-equality
   round-trips, snake_case property fidelity, the `object` keyword
   property, enum, and `petType`-discriminated polymorphism with
   subtype checks.

Then the **structural eval** runs over the authored generator
(checks documented in [`../docs/`](../docs/README.md)). Reference
points: the existing sub-par implementation's signature is
`FAIL(1F+10W)`; the clean stock cohort is `clean`. The target
trajectory across harness iterations is FAIL → warn → clean with all
gates green.

---

## Isolation and cross-run contamination

Each run's workspace lives in a fresh temp dir outside every repo: no
project `CLAUDE.md` ancestors, fresh per-run project memory (keyed by
cwd), no sibling runs to browse, no path hints to the stock
generators. Three layers keep the task honest under
skip-permissions:

1. **Isolation** — the temp workspace.
2. **Declaration** — deny rules in the workspace settings + the hard
   rules in `task.md`.
3. **Audit (the real enforcement)** — the contamination gate scans
   every tool-call input in the transcript; Bash can physically read
   anything, but not *unrecorded*.

Deliberately shared constants (recorded per run): the user-global
`~/.claude/CLAUDE.md`, the skill under test (SHA + snapshot), and
gradle/deno/pnpm caches (dependency bytes, not knowledge).

---

## The diagnose → fix → re-run loop

1. Read `report.md`, then `structural.md` for which rules broke.
2. Scrub the viewer to the red ticks; read the turn pane (inputs +
   errors) and the workspace pane (what the code looked like right
   then). For the plan-level story, skim `timeline.md`: did it load
   the skill, when did `src/base.ts written` fire, did it loop on an
   error?
3. Map the failure to a skill section, edit
   `skmtc/deno/docs/skills/skmtc-generator/SKILL.md`, run
   `deno task verify-docs` in `skmtc/deno`.
4. Re-run with a label: `harness/run.sh <model> after-<fix>`.
5. Compare on the dashboard or `cat runs/index.jsonl` — skill SHA per
   run keeps configurations attributable.

**Single runs are noisy.** A gate flipping once is weak evidence a
skill edit worked; when it matters, run 2–3 per configuration and
read the transcripts, not just the counts.

---

## Components

| File | Role |
|---|---|
| `run.sh` | Orchestrator: seed → provenance → live viewer → claude → gates → archive → index |
| `seed.sh` | Builds the isolated workspace (idempotent, deterministic) |
| `gates.sh` | Runtime gates + structural eval + `report.md` |
| `task.md` | The prompt (verbatim) |
| `timeline.js` | stream-json → one-line-per-action view (`--tee` live mode, file arg post-hoc) |
| `viewer.js` + `viewer.template.html` | Bakes the scrubber viewer (`--template` = live/drag-drop mode) |
| `server.js` | The persistent dashboard (`node harness/server.js`, port `GEN_EVAL_PORT` or 8484, binds 127.0.0.1) |
| `assets/` | Pinned schema, gradle build files, `RoundTripTest.kt` |
| `runs/` | One directory per run + `index.jsonl` (gitignored) |

---

## Troubleshooting

- **Run shows `aborted` on the dashboard** — no result event and the
  transcript has been quiet ≥ 5 min: the run was interrupted (Ctrl-C)
  or crashed. `claude-stderr.log` is empty on interrupts. Artifacts
  up to that point are intact and viewable.
- **compile/round-trip gates `skip`** — no JDK/gradle found. Install
  `brew install openjdk@21` and re-run gates:
  `bash harness/gates.sh runs/<id>/workspace runs/<id>`.
- **Files pane empty mid-run** — check the timeline: the model may
  genuinely not have written anything yet (research phase). The pane
  replays Write/Edit tools and bash heredocs; exotic write methods
  (`sed -i`, python scripts) won't appear.
- **Dashboard not up** — `node harness/server.js` (logs to
  `harness/dashboard.log`); `/health` is the probe run.sh uses.
- **Viewer looks stale for an old run** — re-bake it:
  `node harness/viewer.js runs/<id>`.
- **Gates re-run on an archived run** — works against the copied
  workspace: `bash harness/gates.sh runs/<id>/workspace runs/<id>`
  (the generate gate re-executes `skmtc clean`+`generate` in place).
