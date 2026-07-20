#!/usr/bin/env bash
# Run one gen-kotlin-jackson authoring attempt with a model, capturing
# everything needed for diagnosis. Usage:
#   harness/run.sh <model> [label]
# Examples:
#   harness/run.sh claude-fable-5
#   harness/run.sh sonnet after-skill-fix
set -euo pipefail

MODEL=${1:?usage: run.sh <model> [label]}
LABEL=${2:-}
HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
SKMTC_REPO=$(cd "$HARNESS_DIR/../../.." && pwd)

RUN_ID="$(date +%Y%m%d-%H%M%S)-${MODEL//[^a-zA-Z0-9]/_}${LABEL:+-$LABEL}"
RUN_DIR="$HARNESS_DIR/runs/$RUN_ID"
mkdir -p "$RUN_DIR"
echo "run: $RUN_DIR"

# 0. Toolchain preflight in a throwaway workspace: bundle + generate a
#    minimal Kotlin generator so environment breakage (version skew,
#    stale CLI/worker pins, vendoring gaps) aborts the run here instead
#    of burning agent minutes on a misleading mid-run failure.
bash "$HARNESS_DIR/preflight.sh"

# 1. Seed the workspace in an ISOLATED temp dir outside every repo:
#    no project CLAUDE.md ancestors, fresh per-run project memory
#    (keyed by cwd), no sibling runs to browse, no path hints to the
#    stock generators. Copied back into RUN_DIR at the end.
WORKSPACE=$(mktemp -d "${TMPDIR:-/tmp}/gen-eval-ws.XXXXXX")
cleanup() { rm -rf "$WORKSPACE"; }
trap cleanup EXIT
bash "$HARNESS_DIR/seed.sh" "$WORKSPACE"

# Declare off-limits paths (defense in depth: deny rules for the Read
# tool; the contamination AUDIT gate on the transcript is the real
# enforcement since Bash can read anything under skip-permissions).
# Workspace root = parent of the MAIN skmtc checkout, derived via git so
# harness runs from a linked worktree resolve correctly (the plain
# ../../../.. default landed inside .claude/worktrees/).
SKMTC_ROOT=${SKMTC_ROOT:-$(dirname "$(git -C "$HARNESS_DIR" worktree list --porcelain | head -1 | cut -d' ' -f2-)")}
mkdir -p "$WORKSPACE/.claude"
SETTINGS_PATH="$WORKSPACE/.claude/settings.json" SKMTC_ROOT="$SKMTC_ROOT" node - <<'EOF'
const { writeFileSync } = require('node:fs')
const root = process.env.SKMTC_ROOT
const home = process.env.HOME
const deny = [
  `Read(${root}/skmtc-generators/**)`,
  `Read(${root}/.skmtc/**)`,
  `Read(${root}/kotlin-person-api/**)`,
  `Read(${root}/kotlin-demos/**)`,
  `Read(${root}/kotlin-spring-demo/**)`,
  `Read(${root}/csharp-demos/**)`,
  `Read(${root}/skmtc/packages/gen-eval/harness/runs/**)`,
  // Package caches hold published @skmtc/* sources incl. the Kotlin
  // answer generators — framework source is sanctioned at the
  // workspace's reference/skmtc-deno symlink instead.
  `Read(${home}/.cache/deno/**)`,
  `Read(${home}/Library/Caches/deno/**)`,
  // reference/skmtc-deno symlinks the LIVE repo: reads fine, writes not.
  `Edit(${root}/skmtc/deno/**)`,
  `Write(${root}/skmtc/deno/**)`
]
writeFileSync(process.env.SETTINGS_PATH, JSON.stringify({ permissions: { deny } }, null, 2))
EOF

# 2. Record provenance: skill version + snapshot + the app's git state
#    (the workspace app is copied from the live kotlin-person-api repo)
SKILL_SHA=$(git -C "$SKMTC_REPO" rev-parse HEAD)
TASK_SHA=$(shasum -a 256 "$HARNESS_DIR/task.md" | cut -c1-12)
HARNESS_SHA=$(cat "$HARNESS_DIR/run.sh" "$HARNESS_DIR/seed.sh" "$HARNESS_DIR/gates.sh" \
  "$HARNESS_DIR/preflight.sh" "$HARNESS_DIR/task.md" | shasum -a 256 | cut -c1-12)
SKILL_DIRTY=$(git -C "$SKMTC_REPO" status --porcelain -- deno/docs/skills deno/docs/llms.md | wc -l | tr -d ' ')
PERSON_API_SHA=$(git -C "$SKMTC_ROOT/kotlin-person-api" rev-parse HEAD 2>/dev/null || echo unknown)
PERSON_API_DIRTY=$(git -C "$SKMTC_ROOT/kotlin-person-api" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
# The skmtc on PATH is a compiled binary — its age is provenance the
# git SHAs can't see (a stale binary scaffolds a stale skeleton; run
# 20260720-192026). Preflight asserts the scaffold shape; this records
# which binary actually ran.
SKMTC_BIN=$(command -v skmtc || echo missing)
SKMTC_BIN_MTIME=$([ -f "$SKMTC_BIN" ] && stat -f '%Sm' -t '%Y-%m-%dT%H:%M:%S' "$SKMTC_BIN" || echo unknown)
mkdir -p "$RUN_DIR/skill-snapshot"
cp -RL "$HOME/.claude/skills/skmtc-generator" "$RUN_DIR/skill-snapshot/" 2>/dev/null || true
cp -RL "$HOME/.claude/skills/skmtc-lang-kotlin" "$RUN_DIR/skill-snapshot/" 2>/dev/null || true
META_PATH="$RUN_DIR/meta.json" MODEL="$MODEL" SKILL_SHA="$SKILL_SHA" SKILL_DIRTY="$SKILL_DIRTY" LABEL="$LABEL" TASK_SHA="$TASK_SHA" HARNESS_SHA="$HARNESS_SHA" PERSON_API_SHA="$PERSON_API_SHA" PERSON_API_DIRTY="$PERSON_API_DIRTY" SKMTC_BIN="$SKMTC_BIN" SKMTC_BIN_MTIME="$SKMTC_BIN_MTIME" node - <<'EOF'
const { writeFileSync } = require('node:fs')
writeFileSync(process.env.META_PATH, JSON.stringify({
  model: process.env.MODEL,
  skillSha: process.env.SKILL_SHA,
  skillDirtyFiles: Number(process.env.SKILL_DIRTY),
  label: process.env.LABEL,
  taskSha: process.env.TASK_SHA,
  harnessSha: process.env.HARNESS_SHA,
  personApiSha: process.env.PERSON_API_SHA,
  personApiDirtyFiles: Number(process.env.PERSON_API_DIRTY),
  skmtcBin: process.env.SKMTC_BIN,
  skmtcBinMtime: process.env.SKMTC_BIN_MTIME,
  thinkingBudget: process.env.MAX_THINKING_TOKENS ?? null,
  started: new Date().toISOString()
}, null, 2))
EOF

# 3. LIVE viewer via the persistent dashboard: start it if not
#    already running, bake an un-baked viewer that live-polls the
#    transcript through the dashboard, print the link BEFORE the
#    model starts. Dashboard survives across runs (localhost only).
PORT=${GEN_EVAL_PORT:-8484}
node "$HARNESS_DIR/viewer.js" --template "$RUN_DIR/viewer.html" > /dev/null
if ! curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
  nohup node "$HARNESS_DIR/server.js" > "$HARNESS_DIR/dashboard.log" 2>&1 &
  disown || true
  sleep 0.7
fi
echo ""
echo "=============================================================="
echo "  LIVE viewer (follow along, updates every ~3s):"
echo ""
echo "  http://127.0.0.1:$PORT/runs/$RUN_ID/viewer.html"
echo ""
echo "  all runs: http://127.0.0.1:$PORT/"
echo "=============================================================="
echo ""

# 4. The authoring run — headless, transcript with thinking captured.
#    --dangerously-skip-permissions is scoped to this throwaway
#    workspace; the model needs to run skmtc/deno/gradle freely.
cd "$WORKSPACE"
set +e
claude -p "$(cat "$HARNESS_DIR/task.md")" \
  --model "$MODEL" \
  --output-format stream-json \
  --verbose \
  --dangerously-skip-permissions \
  2> "$RUN_DIR/claude-stderr.log" \
  | tee "$RUN_DIR/transcript.jsonl" \
  | node "$HARNESS_DIR/timeline.js" --tee "$RUN_DIR/timeline.md"
CLAUDE_EXIT=${PIPESTATUS[0]}
set -e
echo "claude exited: $CLAUDE_EXIT"

# 4. Copy the session file (full conversation incl. thinking blocks)
SESSION_GLOB="$HOME/.claude/projects/*$(basename "$WORKSPACE" | tr '.' '-')*"
# shellcheck disable=SC2086
LATEST_SESSION=$(ls -t $SESSION_GLOB/*.jsonl 2>/dev/null | head -1 || true)
[ -n "$LATEST_SESSION" ] && cp "$LATEST_SESSION" "$RUN_DIR/session.jsonl"

# 5. Cost/turn stats from the final stream-json result event
TRANSCRIPT="$RUN_DIR/transcript.jsonl" META_PATH="$RUN_DIR/meta.json" node - <<'EOF'
const { readFileSync, writeFileSync, existsSync } = require('node:fs')
let result = {}
if (existsSync(process.env.TRANSCRIPT)) {
  for (const line of readFileSync(process.env.TRANSCRIPT, 'utf8').split('\n')) {
    let event
    try { event = JSON.parse(line) } catch { continue }
    if (event.type === 'result') {
      result = {
        costUsd: event.total_cost_usd ?? null,
        turns: event.num_turns ?? null,
        durationMs: event.duration_ms ?? null,
        isError: event.is_error ?? null
      }
    }
  }
}
const meta = JSON.parse(readFileSync(process.env.META_PATH, 'utf8'))
meta.result = result
writeFileSync(process.env.META_PATH, JSON.stringify(meta, null, 2))
EOF

# 6. Gates + structural eval + report (run in the live workspace, then
#    archive the workspace into the run dir and remove the temp copy)
set +e
bash "$HARNESS_DIR/gates.sh" "$WORKSPACE" "$RUN_DIR"
GATES_EXIT=$?
set -e
cp -R "$WORKSPACE" "$RUN_DIR/workspace"

# 7. Bake the in-browser viewer (scrubber UI over the transcript)
node "$HARNESS_DIR/viewer.js" "$RUN_DIR" || true

# 8. Append to the runs index for cross-run comparison
INDEX_PATH="$HARNESS_DIR/runs/index.jsonl" RUN_PATH="$RUN_DIR" GATES_EXIT="$GATES_EXIT" node - <<'EOF'
const { readFileSync, appendFileSync, existsSync } = require('node:fs')
const { basename, join } = require('node:path')
const runDir = process.env.RUN_PATH
const meta = JSON.parse(readFileSync(join(runDir, 'meta.json'), 'utf8'))
let aggregate = {}
const structuralPath = join(runDir, 'structural.json')
if (existsSync(structuralPath)) {
  try {
    const reports = JSON.parse(readFileSync(structuralPath, 'utf8'))
    if (reports.length) aggregate = reports[0].aggregate ?? {}
  } catch {}
}
const entry = {
  run: basename(runDir),
  model: meta.model,
  label: meta.label || null,
  skillSha: String(meta.skillSha).slice(0, 12),
  harnessSha: meta.harnessSha ?? null,
  gatesPass: Number(process.env.GATES_EXIT) === 0,
  structural: aggregate.verdict ?? null,
  warnings: aggregate.warningCount ?? null,
  costUsd: meta.result?.costUsd ?? null,
  turns: meta.result?.turns ?? null
}
appendFileSync(process.env.INDEX_PATH, JSON.stringify(entry) + '\n')
console.log(JSON.stringify(entry, null, 2))
EOF

echo ""
echo "=============================================================="
echo "  run complete — gates exit: $GATES_EXIT"
echo ""
echo "  viewer:   file://$RUN_DIR/viewer.html"
echo "  report:   file://$RUN_DIR/report.md"
echo "  timeline: file://$RUN_DIR/timeline.md"
echo ""
echo "  (cmd-click the viewer link, or: open \"$RUN_DIR/viewer.html\")"
echo "=============================================================="
exit "$GATES_EXIT"
