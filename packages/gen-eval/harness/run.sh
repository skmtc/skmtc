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
SKMTC_ROOT=$(cd "$HARNESS_DIR/../../../.." && pwd)
mkdir -p "$WORKSPACE/.claude"
python3 - "$WORKSPACE/.claude/settings.json" "$SKMTC_ROOT" <<'EOF'
import json, sys
root = sys.argv[2]
deny = [
    f"Read({root}/skmtc-generators/**)",
    f"Read({root}/.skmtc/**)",
    f"Read({root}/kotlin-demos/**)",
    f"Read({root}/kotlin-spring-demo/**)",
    f"Read({root}/csharp-demos/**)",
    f"Read({root}/skmtc/packages/gen-eval/harness/runs/**)"
]
json.dump({'permissions': {'deny': deny}}, open(sys.argv[1], 'w'), indent=2)
EOF

# 2. Record provenance: skill version + snapshot
SKILL_SHA=$(git -C "$SKMTC_REPO" rev-parse HEAD)
SKILL_DIRTY=$(git -C "$SKMTC_REPO" status --porcelain -- deno/docs/skills deno/docs/llms.md | wc -l | tr -d ' ')
mkdir -p "$RUN_DIR/skill-snapshot"
cp -RL "$HOME/.claude/skills/skmtc-generator" "$RUN_DIR/skill-snapshot/" 2>/dev/null || true
python3 - "$RUN_DIR/meta.json" "$MODEL" "$SKILL_SHA" "$SKILL_DIRTY" "$LABEL" <<'EOF'
import json, sys, datetime
json.dump({
    'model': sys.argv[2],
    'skillSha': sys.argv[3],
    'skillDirtyFiles': int(sys.argv[4]),
    'label': sys.argv[5],
    'started': datetime.datetime.now().astimezone().isoformat()
}, open(sys.argv[1], 'w'), indent=2)
EOF

# 3. The authoring run — headless, transcript with thinking captured.
#    --dangerously-skip-permissions is scoped to this throwaway
#    workspace; the model needs to run skmtc/deno/gradle freely.
cd "$WORKSPACE"
set +e
claude -p "$(cat "$HARNESS_DIR/task.md")" \
  --model "$MODEL" \
  --output-format stream-json \
  --verbose \
  --dangerously-skip-permissions \
  > "$RUN_DIR/transcript.jsonl" 2> "$RUN_DIR/claude-stderr.log"
CLAUDE_EXIT=$?
set -e
echo "claude exited: $CLAUDE_EXIT"

# 4. Copy the session file (full conversation incl. thinking blocks)
SESSION_GLOB="$HOME/.claude/projects/*$(basename "$WORKSPACE" | tr '.' '-')*"
# shellcheck disable=SC2086
LATEST_SESSION=$(ls -t $SESSION_GLOB/*.jsonl 2>/dev/null | head -1 || true)
[ -n "$LATEST_SESSION" ] && cp "$LATEST_SESSION" "$RUN_DIR/session.jsonl"

# 5. Cost/turn stats from the final stream-json result event
python3 - "$RUN_DIR/transcript.jsonl" "$RUN_DIR/meta.json" <<'EOF'
import json, sys
result = {}
try:
    with open(sys.argv[1]) as transcript:
        for line in transcript:
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get('type') == 'result':
                result = {
                    'costUsd': event.get('total_cost_usd'),
                    'turns': event.get('num_turns'),
                    'durationMs': event.get('duration_ms'),
                    'isError': event.get('is_error')
                }
except FileNotFoundError:
    pass
meta = json.load(open(sys.argv[2]))
meta['result'] = result
json.dump(meta, open(sys.argv[2], 'w'), indent=2)
EOF

# 6. Gates + structural eval + report (run in the live workspace, then
#    archive the workspace into the run dir and remove the temp copy)
set +e
bash "$HARNESS_DIR/gates.sh" "$WORKSPACE" "$RUN_DIR"
GATES_EXIT=$?
set -e
cp -R "$WORKSPACE" "$RUN_DIR/workspace"

# 7. Append to the runs index for cross-run comparison
python3 - "$HARNESS_DIR/runs/index.jsonl" "$RUN_DIR" "$GATES_EXIT" <<'EOF'
import json, sys, os
run_dir = sys.argv[2]
meta = json.load(open(os.path.join(run_dir, 'meta.json')))
structural = {}
try:
    reports = json.load(open(os.path.join(run_dir, 'structural.json')))
    if reports:
        structural = reports[0]['aggregate']
except Exception:
    pass
entry = {
    'run': os.path.basename(run_dir),
    'model': meta['model'],
    'label': meta.get('label') or None,
    'skillSha': meta['skillSha'][:12],
    'gatesPass': int(sys.argv[3]) == 0,
    'structural': structural.get('verdict'),
    'warnings': structural.get('warningCount'),
    'costUsd': (meta.get('result') or {}).get('costUsd'),
    'turns': (meta.get('result') or {}).get('turns')
}
with open(sys.argv[1], 'a') as index:
    index.write(json.dumps(entry) + '\n')
print(json.dumps(entry, indent=2))
EOF

echo ""
echo "done — review: $RUN_DIR/report.md, then structural.md, then transcript.jsonl"
exit "$GATES_EXIT"
