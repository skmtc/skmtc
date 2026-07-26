# gen-kotlin-jackson authoring harness

Runs a model against the task "author `gen-kotlin-jackson` from
scratch: recreate kotlin-person-api's `Dtos.kt` from its OpenAPI
schema" in a fresh, isolated SKMTC workspace; captures everything
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
   *outside every repo*: `skmtc init lab`, `@skmtc/lang-kotlin`
   vendored from `skmtc/deno/lang-kotlin` as a deno workspace member,
   the app copied straight from the `kotlin-person-api` repo under its
   own name — **minus only its `Dtos.kt`**, the file the generator
   must recreate; the SKMTC project pins the app's own
   `openapi.json` — and read-only reference material
   (`reference/Dtos.kt` — the target, copied from the repo — the
   vendored `gen-typescript` / `gen-zod` sources, and
   `reference/skmtc-deno`, a read-only symlink to the monorepo's deno
   workspace so core/lang API surfaces are looked up at the source
   instead of scoured from package caches). Integrity checksums are
   recorded.
2. **Deny rules** — the workspace's `.claude/settings.json` declares
   the stock generators, demo apps, previous runs, and the deno
   package caches (`~/.cache/deno`, `~/Library/Caches/deno` — they
   hold published `@skmtc/*` incl. the Kotlin answers) off-limits for
   reads, and the live `skmtc/deno` tree off-limits for writes.
3. **Provenance** — `meta.json` records model, label, skill git SHA
   (+ dirty-file count), thinking budget, start time; the
   skmtc-generator and skmtc-lang-kotlin skills are snapshotted into
   the run dir.
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
7. **Gates** (`gates.sh`) — see below; the structural eval over the
   authored generator is one of the gates. Writes `report.md`.
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
  cost, largest think block (tokens / seconds), and skill SHA.
  Auto-refreshes. The think column reads from `meta.thinking`, so runs
  archived before that field existed show `—`.
- **Live viewer** — `http://127.0.0.1:8484/runs/<id>/viewer.html`
  polls the transcript every ~3 s. It *tails* the newest turn while
  you're at the end and *holds your position* if you've scrubbed
  back.

### Milestones

Detected in `timeline.js` and the viewer (green ticks on the scrubber
track); each fires once, on first occurrence — except `deep think`,
which fires per block (see below):

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
| `deep think` | a think block over 60 s of wall clock **or** 5000 estimated tokens — fires per block, not once |
| `run finished — turns/cost` | the stream's result event (viewer only) |

`deep think` is the one milestone that repeats: a run can stall
repeatedly and each stall is a separate thing to bracket. The
thresholds are `DEEP_THINK_SECONDS` / `DEEP_THINK_TOKENS` in
`timeline.js` and `viewer.template.html` — 60 s is an order of
magnitude above the typical few-second block (long enough to read as a
stall while you watch the terminal), 5000 tokens is past step-level
deliberation into plan-scale reasoning; either alone fires, since a
fast large block and a slow small one are both worth a look. In the
viewer it gets a violet scrubber tick of its own (legend: *deep
think*) and a header block stating the gap, token estimate, and
context size.

**Feedback marks** (every occurrence, not once-only): `WHY:` assistant
lines render as `>>> WHY: …` in the timeline and as blue-badged blocks
+ blue scrubber ticks in the viewer; every `FRICTION.md` append prints
`*** FRICTION: <entry title>`, every `RETRO.md` write prints
`*** RETRO written`, and every `PLAN.md` write prints
`*** PLAN written/amended`, with amber badges/ticks in the viewer. The
scrubber legend shows all four tick colors — amber ticks are your
jump-to-friction navigation.

`PLAN.md` is the highest-value of the three to read against the think
blocks. Reasoning is redacted, so a plan the model keeps in its head
leaves nothing behind but a wall-clock gap; the task therefore asks
for the module list, the router-case mapping, and the policy
decisions to be written down *before* implementation. Comparing when
the plan mark fires against when the deep-think block fires is the
direct measure of whether the run externalized its design or
deliberated it silently.

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

**Redacted is not unmeasured.** The stream carries
`system/thinking_tokens` events (cumulative *within* a block — the
deltas restart at each new block, so the last value before an assistant
message is that block's size, never a sum across blocks), and every
assistant message carries a `timestamp` and a `usage` block. So each
think block has a size (estimated tokens), a wall-clock cost (the gap
back to the previous timestamped event — assistant or tool result), and
a context size (`cache_read + cache_creation`) — all without a word of
the reasoning. What remains unavailable is *why*, and the only
substitute is **bracketing**: the tool calls immediately before a block
are what the model had just seen, and the assistant text plus first
`Write`/`Edit` after it are what the block decided. A block is
diagnosed by reading those two ends. This matters because the blocks
are not uniform — in run `20260720-223422` a single block took 51,550
estimated tokens and 477 s, 55% of the entire run's wall clock, and
nothing in the harness said so until `thinking.js` existed.

Post-hoc tooling: `node harness/thinking.js <run-dir>` prints the
bracketed think-block table (`--summary` for the one-liner `report.md`
carries, `--json` for the `meta.json` metrics); `node
harness/viewer.js <run-dir>` re-bakes a static viewer; `node
harness/viewer.js --template out.html` builds a drag-and-drop page that
opens any transcript; `node harness/timeline.js <transcript.jsonl>`
re-renders a timeline.

`thinking.js` lists blocks **largest first**, not in run order: the
distribution is long-tailed — one block routinely carries most of the
reasoning — so the block you have to read is the first one printed. Run
order is not lost, since every record carries its elapsed time into the
run. The footer line gives total thinking tokens, thinking as a share
of the model's total output tokens, and the largest block's share of
run wall clock.

---

## The task given to the model

[`task.md`](task.md) is passed verbatim as the prompt. Its deliberate
calibration:

- **Skill loading is instructed, not discovered** — the eval measures
  whether the *skills teach the shape*, not whether the model finds
  them. Three skills are named: `skmtc-generator`,
  `skmtc-lang-kotlin`, and `skmtc-cli`.
- **The reference output is the spec** — `reference/Dtos.kt` (the
  repo's hand-written file, copied at seed time) is what the
  generator must recreate: money-as-string serde,
  `kind`-discriminated sealed hierarchy, enum wire values +
  `@JsonEnumDefaultValue` fallback, `readOnly`/`writeOnly` access,
  the ISO `@JsonFormat` timestamp, the `additionalProperties` map
  default. Its KDoc prose is not in the schema, so the run reports a
  diff rather than demanding byte-equality.
- **Cross-language references are provided, Kotlin answers are not**
  — the vendored `gen-typescript`/`gen-zod` show how a model
  generator walks schemas and composes producers; the stock Kotlin
  generators and the original repos stay off-limits (deny rules +
  audit). The task warns that some principles do not transfer 1:1
  across languages.
- **Framework source is sanctioned, caches are not** —
  `reference/skmtc-deno` links the monorepo's deno workspace (core
  engine, lang packages, concept docs) so `@skmtc/core` API questions
  are answered at the source. The deno package caches are fenced
  instead: they contain published `@skmtc/*` packages including the
  Kotlin answer generators, and a pre-fence run wandered into
  `~/.cache/deno` hunting core's types.
- **lang-kotlin is taught by its own skill** — `skmtc-lang-kotlin`
  carries the head+value rendering model, the interface shapes, and a
  scaffold; the vendored source stays available as ground truth.
  (Historical: earlier task versions pointed at the source with no
  skill — every pre-skill run exhausted its budget reverse-engineering
  the API and authored nothing; that research spiral is what the
  skill exists to collapse.)
- **Hard rules name the enforcement** — tests are checksum-verified;
  copying from other implementations is audited.

The task also carries a **narrate-and-log protocol** — the model's
self-reported rationale and friction, replacing the reasoning the API
redacts:

- **`WHY:` lines** — one visible sentence of intent before each
  significant action, streamed into the timeline and viewer as
  ordinary assistant text (this channel is NOT redacted).
- **`FRICTION.md`** (workspace root) — appended the moment the model
  hits missing info, a surprising API, or a forced guess. Each entry
  ends with an **Unblocker**: the exact info that would have unblocked
  it instantly — i.e. the model drafts the missing skill content for
  you. Watch it grow live in the viewer's file tree; `report.md`
  shows the entry count.
- **`RETRO.md`** — an exit retro (top pain points, what was missing
  from the skills, advice to the next agent), written before the
  final summary.

Milestones fire for the first friction entry and the exit retro.
Feed the unblockers into the skill, re-run, and compare — the same
loop as `skmtc-retro`, applied to the agent under test. Caveat: the
protocol adds mild observer effect and changed the prompt;
`meta.json` records `taskSha` so runs on different task versions are
never silently compared.

To run variants (e.g. drop the skill-loading instruction), edit
`task.md` and tag the run with a label; the prompt is in git and
checksummed into `meta.json`, so variants stay reconstructable.

Beyond the prompt, the model gets: the standard Claude Code system
prompt, the user-global `~/.claude/CLAUDE.md` (a constant across
runs), and the user-level skills. No project CLAUDE.md loads (the
workspace is outside every repo) and per-run project memory starts
empty.

---

## What a run produces — `runs/<id>/`

| File | What it is |
|---|---|
| `report.md` | Gates table + structural verdict, plus the source/grader dive counts, reference diff, feedback-channel counts, and the **Thinking** line (total estimated tokens, share of model output, largest block in tokens/seconds/share of wall clock) — **read this first** |
| `viewer.html` | The scrubber viewer (live during the run, static after) |
| `timeline.md` | Turn-by-turn skim view: milestones, tool calls, errors |
| `structural.md` / `.json` | The structural eval (all checks + aggregate verdict) over the authored generator |
| `transcript.jsonl` | Full stream-json feed: every tool call, every event |
| `session.jsonl` | The Claude Code session file (backup capture) |
| `meta.json` | Model, label, skill SHA + dirty flag, thinking budget, cost, turns, duration, `thinking` (block count, `thinkTotalTokens`, share of output, `maxThinkBlock`: tokens / seconds / elapsed / context / what it decided) |
| `skill-snapshot/` | The skmtc-generator + skmtc-lang-kotlin skills exactly as this run saw them |
| `workspace/` | The full sandbox: authored generator at `.skmtc/lab/gen-kotlin-jackson/`, generated file at `kotlin-person-api/src/main/kotlin/com/example/api/dto/Dtos.generated.kt`, reference material at `reference/` |
| `generate.json`, `compile.log`, `dtos-diff.txt`, `integrity.log` | Raw gate evidence + the reference diff |
| `../index.jsonl` | One line per run: model, skill SHA, gates, verdict, cost, turns, `thinkTotalTokens`, `maxThinkBlockTokens`, `maxThinkBlockSeconds` |

---

## The gates (ground truth, no judging)

0. **contamination** — no tool-call input touched generator
   implementations outside the vendored references, the original
   kotlin-person-api, demo apps, or previous runs (transcript audit).
1. **integrity** — the app's sources / build files / schema /
   reference material untouched (checksums; edits disqualify the
   run).
2. **generate** — `skmtc clean` + `skmtc generate` from the bundle
   exits with no errors (also catches hand-written output
   masquerading as generated: clean deletes it, generate must
   recreate it).
3. **dtos-file** — the single
   `com/example/api/dto/Dtos.generated.kt` exists and declares every
   `components.schemas` entry (default `generatedSuffix`; Kotlin
   resolves by package, so the hand-written `Dtos.kt` name is not
   required).
4. **compile** — `gradle compileKotlin`: the whole Spring Boot app
   (controller, services, serde, config) compiles against the
   generated DTOs (skipped with a note if no gradle).
5. **dto-contract** — `gradle test`: the app's `DtoContractTest`
   suite exercises serde round-trips the compile gate cannot see
   (skipped with a note if no gradle).
6. **structural** — the structural eval over the authored generator
   (checks documented in [`../docs/`](../docs/README.md)): a `fail`
   aggregate verdict fails the gate; `warn` passes with the warning
   count in the detail. A missing generator or unreadable eval is a
   loud FAIL — green gates must never coexist with an unread
   structural FAIL.

The report also surfaces a **reference diff** (not a gate): the
generated `Dtos.generated.kt` diffed against the repo's real
hand-written `Dtos.kt` (`dtos-diff.txt`). Declarations, annotations, types, and defaults are
derivable from the schema and should converge to zero; KDoc prose is
authored commentary absent from the schema, so those lines are
expected to remain.

Structural reference points: the existing sub-par implementation's
signature is `FAIL(1F+10W)`; the clean stock cohort is `clean`. The
target trajectory across harness iterations is FAIL → warn → clean
with all gates green.

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
`~/.claude/CLAUDE.md`, the skills under test (SHA + snapshot), and
gradle/deno/pnpm caches as *build infrastructure* (the toolchains
resolve dependencies through them). Reading cache **contents** is
fenced, though: the deno caches carry published `@skmtc/*` sources
including the Kotlin answer generators, so `~/.cache/deno` and
`~/Library/Caches/deno` are deny-ruled and audited — API questions
belong at `reference/skmtc-deno` instead.

---

## The diagnose → fix → re-run loop

1. Read `report.md`, then `structural.md` for which rules broke.
2. Scrub the viewer to the red ticks; read the turn pane (inputs +
   errors) and the workspace pane (what the code looked like right
   then). For the plan-level story, skim `timeline.md`: did it load
   the skill, when did `src/base.ts written` fire, did it loop on an
   error?

   If the report's **Thinking** line shows a block that ate a large
   share of the run — or the timeline fired `deep think` — run `node
   harness/thinking.js harness/runs/<id>` and read that block's bracket: the
   tool calls before it are the evidence it was reasoning over, the
   `Write` after it is the conclusion it reached. A long block followed
   by a small, confident write usually means the skills left it
   deriving something they could have stated.
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
| `thinking.js` | Think-block analysis: per-block wall gap, estimated tokens, context size, bracketed by the tool calls before and the decision after (`--summary` → the `report.md` line, `--json` → the `meta.json` metrics) |
| `viewer.js` + `viewer.template.html` | Bakes the scrubber viewer (`--template` = live/drag-drop mode) |
| `server.js` | The persistent dashboard (`node harness/server.js`, port `GEN_EVAL_PORT` or 8484, binds 127.0.0.1) |
| `runs/` | One directory per run + `index.jsonl` (gitignored) |

---

## Troubleshooting

- **Run shows `aborted` on the dashboard** — no result event and the
  transcript has been quiet ≥ 5 min: the run was interrupted (Ctrl-C)
  or crashed. `claude-stderr.log` is empty on interrupts. Artifacts
  up to that point are intact and viewable.
- **compile gate `skip`** — no gradle found. Install
  `brew install gradle openjdk@21` and re-run gates:
  `bash harness/gates.sh harness/runs/<id>/workspace harness/runs/<id>`.
- **Files pane empty mid-run** — check the timeline: the model may
  genuinely not have written anything yet (research phase). The pane
  replays Write/Edit tools and bash heredocs; exotic write methods
  (`sed -i`, python scripts) won't appear.
- **Dashboard not up** — `node harness/server.js` (logs to
  `harness/dashboard.log`); `/health` is the probe run.sh uses.
- **Viewer looks stale for an old run** — re-bake it:
  `node harness/viewer.js harness/runs/<id>`.
- **Gates re-run on an archived run** — works against the copied
  workspace: `bash harness/gates.sh harness/runs/<id>/workspace harness/runs/<id>`
  (the generate gate re-executes `skmtc clean`+`generate` in place).
