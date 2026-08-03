#!/bin/bash
# task1k runner (Kotlin + Jackson model generator authoring).
# Usage: ./run1k.sh <arm> <run-id> [model]
#   arm: baseline | skills
#   model: defaults to "opus" (EXP-5 decision 2026-08-03 — all runs on Opus)
#
# Arm isolation is by SYMLINK SHUFFLE in ~/.claude/skills (sequential runs
# only): all skmtc-* links are parked for every run; the skills arm gets
# the generator/lang-ts/model v3 links restored. An exit trap restores
# everything. NOTE: v3 skills live in the skmtc-skills-v3 WORKTREE (the
# main checkout is on main, which predates them).
set -euo pipefail

ARM="${1:?arm required: baseline|skills}"
RUN_ID="${2:?run-id required}"
MODEL="${3:-opus}"

EXP_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
PARK_DIR="$HOME/.claude/skills-parked-exp"
SKILL_SRC="/Users/dmitrigrabov/workspace/skmtc-root/skmtc-skills-v3/deno/docs/skills"
RESULTS_DIR="$EXP_DIR/results/$RUN_ID"
WORK_DIR="${TMPDIR:-/tmp}/skmtc-exp/$RUN_ID"

ARM_SKILLS=(skmtc-generator-v3 skmtc-lang-kotlin-v3 skmtc-model-v3)

[ -e "$RESULTS_DIR" ] && { echo "run-id already used: $RESULTS_DIR"; exit 1; }

restore_skills() {
  for s in "${ARM_SKILLS[@]}"; do
    [ -L "$SKILLS_DIR/$s" ] && rm "$SKILLS_DIR/$s"
  done
  if [ -d "$PARK_DIR" ]; then
    mv "$PARK_DIR"/* "$SKILLS_DIR"/ 2>/dev/null || true
    rmdir "$PARK_DIR" 2>/dev/null || true
  fi
}
trap restore_skills EXIT

mkdir -p "$PARK_DIR"
for link in "$SKILLS_DIR"/skmtc-*; do
  [ -e "$link" ] || continue
  mv "$link" "$PARK_DIR/"
done

if [ "$ARM" = "skills" ]; then
  for s in "${ARM_SKILLS[@]}"; do
    ln -sfn "$SKILL_SRC/$s" "$SKILLS_DIR/$s"
  done
fi

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cp -r "$EXP_DIR/template/." "$WORK_DIR/"
cp -r "$EXP_DIR/fixture" "$WORK_DIR/"

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
Before writing any code, invoke the skill `skmtc-model-v3`, then
`skmtc-generator-v3`, then `skmtc-lang-kotlin-v3`, and follow them. The
model-v3 skeleton emits TypeScript — keep its SHAPE and edge-case
handling, but take every Kotlin call shape from skmtc-lang-kotlin-v3.
After each meaningful change, run `deno task verify` and read its output
before continuing.
EOF
    ;;
  *) echo "unknown arm: $ARM"; exit 1 ;;
esac

echo "── run $RUN_ID (arm: $ARM, model: $MODEL) in $WORK_DIR"
mkdir -p "$RESULTS_DIR"

cd "$WORK_DIR"
START_TS=$(date +%s)
set +e
claude -p --verbose --output-format stream-json \
  --model "$MODEL" \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep,Skill" \
  < "$PROMPT_FILE" > "$RESULTS_DIR/transcript.jsonl" 2> "$RESULTS_DIR/stderr.txt"
AGENT_EXIT=$?
set -e
DURATION=$(( $(date +%s) - START_TS ))
echo "agent exit: $AGENT_EXIT (${DURATION}s)"

set +e
node "$EXP_DIR/score1k.mjs" "$WORK_DIR" | tee "$RESULTS_DIR/score-summary.txt"
set -e
cp "$WORK_DIR/score.json" "$RESULTS_DIR/" 2>/dev/null || true
mkdir -p "$RESULTS_DIR/workspace"
rsync -a --exclude node_modules --exclude .prompt.md "$WORK_DIR/" "$RESULTS_DIR/workspace/"
cp "$PROMPT_FILE" "$RESULTS_DIR/prompt.md" 2>/dev/null || true
echo "{\"arm\": \"$ARM\", \"runId\": \"$RUN_ID\", \"task\": \"task1k\", \"model\": \"$MODEL\", \"agentExit\": $AGENT_EXIT, \"durationSeconds\": $DURATION}" > "$RESULTS_DIR/meta.json"

echo "── archived to $RESULTS_DIR"
