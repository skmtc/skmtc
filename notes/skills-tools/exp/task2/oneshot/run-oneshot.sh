#!/bin/bash
# EXP-4: the one-shot arm. Usage: ./run-oneshot.sh <run-id> [model]
# Pre-assembled context → ONE no-tools generation call → programmatic
# verify → at most ONE error-fed repair call → score.
# Measures: first-pass green rate, wall (warm), cost, outsideShare.
set -euo pipefail

RUN_ID="${1:?run-id required}"
MODEL="${2:-}"

HERE="$(cd "$(dirname "$0")" && pwd)"          # exp/task2/oneshot
TASK2="$(cd "$HERE/.." && pwd)"                # exp/task2
EXP="$(cd "$TASK2/.." && pwd)"                 # exp
SKILLS=/Users/dmitrigrabov/workspace/skmtc-root/skmtc/deno/docs/skills
RESULTS="$EXP/results/$RUN_ID"
WORK="${TMPDIR:-/tmp}/skmtc-exp/$RUN_ID"

[ -e "$RESULTS" ] && { echo "run-id already used"; exit 1; }
mkdir -p "$RESULTS"

rm -rf "$WORK"; mkdir -p "$WORK"
cp -r "$TASK2/template/." "$WORK/"
cp -r "$TASK2/fixture" "$WORK/"

# ── Assemble the prompt (deterministic; this is the pipeline's cached prefix)
PROMPT="$WORK/.prompt.md"
{
  cat "$WORK/TASK.md"
  cat <<'EOF'

## ONE-SHOT MODE (important)

Do NOT use any tools. Reply with the COMPLETE generator package as file
blocks and nothing else — every file the package needs, each in this
exact fence format:

===FILE: gen-api-client/deno.json===
<file content>
===END===

All reference material you need is below; do not ask questions.

## Reference: skill skmtc-generator-v3
EOF
  cat "$SKILLS/skmtc-generator-v3/SKILL.md"
  echo; echo "## Reference: skill skmtc-lang-typescript-v3"
  cat "$SKILLS/skmtc-lang-typescript-v3/SKILL.md"
  echo; echo "## Partial exemplar: @skmtc/gen-express (accumulator entry — note: uses context.insertOperation for the container; findDefinition ?? defineAndRegister is the other accumulator form)"
  echo '```ts'; cat "$HERE/context/gen-express-mod.ts"; echo; cat "$HERE/context/gen-express-app.ts"; echo '```'
  echo; echo "## Partial exemplar: @skmtc/gen-tanstack-query-fetch-zod QueryFn (consuming gen-zod via insertNormalizedModel)"
  echo '```ts'; cat "$HERE/context/gen-tanstack-queryfn.ts"; echo '```'
  echo; echo "## The input schema (fixture/openapi.json)"
  echo '```json'; cat "$WORK/fixture/openapi.json"; echo '```'
} > "$PROMPT"

cd "$WORK"

# ── Warm the dependency cache (the architecture's warm-pool assumption;
#    measured separately from the run proper)
WARM0=$(date +%s)
echo 'import "@skmtc/core"; import "@skmtc/lang-typescript"; import "@skmtc/gen-zod"; import "zod"; import "ts-pattern"' > .warm.ts
deno cache .warm.ts >/dev/null 2>&1 || true
rm -f .warm.ts
WARM_S=$(( $(date +%s) - WARM0 ))

extract_files() {  # stdin: model text with ===FILE:...===/===END=== fences
  node -e '
    const fs = require("fs")
    const text = fs.readFileSync(0, "utf8")
    const blocks = [...text.matchAll(/^===FILE: (.+?)===\n([\s\S]*?)\n===END===/gm)]
    for (const [, rawPath, content] of blocks) {
      const path = rawPath.trim()
      if (path.includes("..") || !path.startsWith("gen-api-client/")) continue
      fs.mkdirSync(require("path").dirname(path), { recursive: true })
      fs.writeFileSync(path, content.endsWith("\n") ? content : content + "\n")
      console.log("wrote", path)
    }
    console.log("blocks:", blocks.length)
  '
}

call_claude() {  # $1: prompt file, $2: output transcript
  claude -p --verbose --output-format stream-json ${MODEL:+--model "$MODEL"} \
    < "$1" > "$2" 2>"$RESULTS/stderr.txt" || true
  node -e '
    const lines = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n")
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes("total_cost_usd")) {
        const r = JSON.parse(lines[i])
        console.error(JSON.stringify({ cost: r.total_cost_usd, turns: r.num_turns }))
        require("fs").writeFileSync(process.argv[2], r.result ?? "")
        break
      }
    }
  ' "$2" "$2.text"
}

T0=$(date +%s)

# ── Call 1: generate everything
call_claude "$PROMPT" "$RESULTS/gen1.jsonl"
extract_files < "$RESULTS/gen1.jsonl.text" | tee "$RESULTS/files1.log"

set +e
deno task verify > "$RESULTS/verify1.log" 2>&1
V1=$?
set -e
FIRST_PASS_GREEN=$([ $V1 -eq 0 ] && echo true || echo false)
ATTEMPTS=1

# ── Repair (at most one), error-fed
if [ $V1 -ne 0 ]; then
  ATTEMPTS=2
  {
    echo "Your generator package failed verification. Fix it."
    echo "Reply ONLY with corrected file blocks (same ===FILE:/===END=== format);"
    echo "you may rewrite any subset of files. No tools, no commentary."
    echo; echo "## Error messages (fix the FIRST one first)"
    grep -m4 -A1 "TypeError\|Error:\|error\[" "$RESULTS/verify1.log" | head -20
    echo; echo "## Current files"
    for f in $(find gen-api-client -name '*.ts' -o -name '*.json'); do
      echo "===FILE: $f==="; cat "$f"; echo "===END==="
    done
    echo; echo "## Verification output (tail)"
    tail -60 "$RESULTS/verify1.log"
  } > "$WORK/.repair.md"
  call_claude "$WORK/.repair.md" "$RESULTS/gen2.jsonl"
  extract_files < "$RESULTS/gen2.jsonl.text" | tee "$RESULTS/files2.log"
  set +e
  deno task verify > "$RESULTS/verify2.log" 2>&1
  V2=$?
  set -e
fi

WALL=$(( $(date +%s) - T0 ))

# ── Score + archive
set +e
node "$TASK2/score2.mjs" "$WORK" | tee "$RESULTS/score-summary.txt"
set -e
cp "$WORK/score.json" "$RESULTS/" 2>/dev/null || true
mkdir -p "$RESULTS/workspace"
rsync -a --exclude node_modules "$WORK/gen-api-client" "$WORK/out" "$RESULTS/workspace/" 2>/dev/null || true
cp "$PROMPT" "$RESULTS/prompt.md"

echo "{\"arm\":\"oneshot\",\"runId\":\"$RUN_ID\",\"model\":\"${MODEL:-default}\",\"firstPassGreen\":$FIRST_PASS_GREEN,\"attempts\":$ATTEMPTS,\"wallSeconds\":$WALL,\"warmupSeconds\":$WARM_S}" > "$RESULTS/meta.json"
echo "── one-shot $RUN_ID: firstPassGreen=$FIRST_PASS_GREEN attempts=$ATTEMPTS wall=${WALL}s (warmup ${WARM_S}s excluded)"
