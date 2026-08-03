#!/bin/bash
# Runs one experiment session. Usage: ./run.sh <arm> <run-id>
#   arm: baseline | skills | tools
#
# Arm isolation is by SYMLINK SHUFFLE in ~/.claude/skills (sequential runs
# only): all skmtc-* links are parked for every run; the skills/tools arms
# get ONLY the three v3 links restored. An exit trap restores everything.
set -euo pipefail

ARM="${1:?arm required: baseline|skills|tools}"
RUN_ID="${2:?run-id required}"
# Optional model tier (e.g. sonnet). Empty = the CLI default.
MODEL="${3:-}"

# This script lives in exp/task2/; EXP_DIR is the exp/ root so template,
# scorer, proto-tool, and the shared results tree all resolve correctly.
EXP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
PARK_DIR="$HOME/.claude/skills-parked-exp"
SKILL_SRC="/Users/dmitrigrabov/workspace/skmtc-root/skmtc/deno/docs/skills"
RESULTS_DIR="$EXP_DIR/results/$RUN_ID"
WORK_DIR="${TMPDIR:-/tmp}/skmtc-exp/$RUN_ID"

[ -e "$RESULTS_DIR" ] && { echo "run-id already used: $RESULTS_DIR"; exit 1; }

restore_skills() {
  # Remove any v3 links we created, then un-park everything.
  for s in skmtc-generator-v3 skmtc-lang-typescript-v3 skmtc-lang-kotlin-v3; do
    [ -L "$SKILLS_DIR/$s" ] && rm "$SKILLS_DIR/$s"
  done
  if [ -d "$PARK_DIR" ]; then
    mv "$PARK_DIR"/* "$SKILLS_DIR"/ 2>/dev/null || true
    rmdir "$PARK_DIR" 2>/dev/null || true
  fi
}
trap restore_skills EXIT

# Park every skmtc-* skill link (and docs-writing stays — not generator-related).
mkdir -p "$PARK_DIR"
for link in "$SKILLS_DIR"/skmtc-*; do
  [ -e "$link" ] || continue
  mv "$link" "$PARK_DIR/"
done

# Arm-specific skill availability.
if [ "$ARM" != "baseline" ]; then
  for s in skmtc-generator-v3 skmtc-lang-typescript-v3; do
    ln -sfn "$SKILL_SRC/$s" "$SKILLS_DIR/$s"
  done
fi

# Assemble the workspace.
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cp -r "$EXP_DIR/task2/template/." "$WORK_DIR/"
cp -r "$EXP_DIR/task2/fixture" "$WORK_DIR/"

# Assemble the prompt: shared task + arm-specific working-method addendum.
PROMPT_FILE="$WORK_DIR/.prompt.md"
cp "$WORK_DIR/TASK.md" "$PROMPT_FILE"
case "$ARM" in
  baseline)
    cat >> "$PROMPT_FILE" <<'EOF'

## Working method
After each meaningful change, run `deno task verify` and read its output
before continuing.
EOF
    ;;
  skills)
    cat >> "$PROMPT_FILE" <<'EOF'

## Working method
Before writing any code, invoke the skill `skmtc-generator-v3` and then
`skmtc-lang-typescript-v3`, and follow them. After each meaningful change,
run `deno task verify` and read its output before continuing.
EOF
    ;;
  tools)
    cat >> "$PROMPT_FILE" <<'EOF'

## Working method
Before writing any code, invoke the skill `skmtc-generator-v3` and then
`skmtc-lang-typescript-v3`, and follow them. After each meaningful change,
run `deno task verify`, then inspect what the engine actually did for a
subject with:
  node inspect-subject.mjs capture.json @exp/gen-api-client <ModelName>
Read both outputs before continuing.
EOF
    cp "$EXP_DIR/../proto-inspect-subject.mjs" "$WORK_DIR/inspect-subject.mjs"
    ;;
  *) echo "unknown arm: $ARM"; exit 1 ;;
esac

echo "── run $RUN_ID (arm: $ARM) in $WORK_DIR"
mkdir -p "$RESULTS_DIR"

cd "$WORK_DIR"
START_TS=$(date +%s)
set +e
# stream-json + verbose: capture the full event stream (every tool call),
# so process metrics (first-code-shape, tool usage) are measurable.
claude -p --verbose --output-format stream-json \
  ${MODEL:+--model "$MODEL"} \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep,Skill" \
  < "$PROMPT_FILE" > "$RESULTS_DIR/transcript.jsonl" 2> "$RESULTS_DIR/stderr.txt"
AGENT_EXIT=$?
set -e
DURATION=$(( $(date +%s) - START_TS ))
echo "agent exit: $AGENT_EXIT (${DURATION}s)"

# Score and archive.
set +e
node "$EXP_DIR/task2/score2.mjs" "$WORK_DIR" | tee "$RESULTS_DIR/score-summary.txt"
set -e
cp "$WORK_DIR/score.json" "$RESULTS_DIR/" 2>/dev/null || true
mkdir -p "$RESULTS_DIR/workspace"
rsync -a --exclude node_modules --exclude .prompt.md "$WORK_DIR/" "$RESULTS_DIR/workspace/"
cp "$PROMPT_FILE" "$RESULTS_DIR/prompt.md" 2>/dev/null || true
echo "{\"arm\": \"$ARM\", \"runId\": \"$RUN_ID\", \"model\": \"${MODEL:-default}\", \"agentExit\": $AGENT_EXIT, \"durationSeconds\": $DURATION}" > "$RESULTS_DIR/meta.json"

echo "── archived to $RESULTS_DIR"
