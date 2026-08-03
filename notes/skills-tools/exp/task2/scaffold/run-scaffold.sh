#!/bin/bash
# Scaffolder v0: template (invariant coordination) + parallel model slot-fill.
# Usage: ./run-scaffold.sh <run-id> [fill-model] [repair-model]
# Defaults: fill=haiku, repair=haiku (escalation measured, not assumed).
set -euo pipefail

RUN_ID="${1:?run-id required}"
FILL_MODEL="${2:-haiku}"
REPAIR_MODEL="${3:-haiku}"

HERE="$(cd "$(dirname "$0")" && pwd)"          # exp/task2/scaffold
TASK2="$(cd "$HERE/.." && pwd)"
EXP="$(cd "$TASK2/.." && pwd)"
RESULTS="$EXP/results/$RUN_ID"
WORK="${TMPDIR:-/tmp}/skmtc-exp/$RUN_ID"

[ -e "$RESULTS" ] && { echo "run-id already used"; exit 1; }
mkdir -p "$RESULTS"
rm -rf "$WORK"; mkdir -p "$WORK"
cp -r "$TASK2/template/." "$WORK/"          # workspace rig (harness, deno.json, fixture cfgs)
cp -r "$TASK2/fixture" "$WORK/"
cp -r "$HERE/template/gen-api-client" "$WORK/"   # the scaffold with SLOT markers
cd "$WORK"

# Warm dependency cache (warm-pool assumption; measured separately)
WARM0=$(date +%s)
echo 'import "@skmtc/core"; import "@skmtc/lang-typescript"; import "@skmtc/gen-zod"; import "zod"' > .warm.ts
deno cache .warm.ts >/dev/null 2>&1 || true; rm -f .warm.ts
WARM_S=$(( $(date +%s) - WARM0 ))

# ── Slot specs ──────────────────────────────────────────────────────────
slot_prompt() { # $1 slot name; emits the fill prompt on stdout
  local slot="$1"
  cat <<EOF
You are filling ONE slot in a pre-scaffolded SKMTC generator (TypeScript,
Deno). Reply with ONLY the code that replaces the marker /*SLOT:$slot*/ —
no fences, no commentary, no imports (everything needed is already
imported in the file). Match the file's indentation at the marker.

House rule (the one that matters): during generation, output text does
not exist — values stored on the instance are objects or plain data;
target-language syntax is composed ONLY inside toString() bodies.

EOF
  case "$slot" in
    naming) cat <<'EOF'
CONTRACT for SLOT:naming (in src/base.ts, module scope): export exactly
three functions used by the entry and snippets:
- toClientName(tag: string): string — PascalCase of the tag + 'Client'
  (tag 'orders' → 'OrdersClient'). Use capitalize(camelCase(tag)).
- toClientExportPath(tag: string): string — join('@', 'client',
  `${toClientName(tag)}.generated.ts`).
- toMethodName(operation: OasOperation): string — deterministic from
  method+path via decapitalize(toEndpointName(operation)). NEVER use
  operationId.
EOF
    ;;
    method-fields) cat <<'EOF'
CONTRACT for SLOT:method-fields (class-field declarations of
ClientMethod, indented two spaces): declare the instance fields the
constructor below will set and toString() will read. Required fields:
name (string, the method name), path (string), method (string, http
verb), pathParams (string[]), hasBody (boolean), zodName (string — the
response schema constant's name). Plain declarations only.
EOF
    ;;
    method-data) cat <<'EOF'
CONTRACT for SLOT:method-data (constructor body of ClientMethod, after
super(); indented four spaces). Using the available imports
(decapitalize, toEndpointName, OasVoid, ZodProjection) and the args
(context, operation, destinationPath), set every declared field:
- this.name: decapitalize(toEndpointName(operation))
- this.path / this.method: from the operation
- this.pathParams: names of path parameters — operation.toParams(['path'])
  returns parameter objects with .name
- this.hasBody: whether a request body exists —
  operation.toRequestBody(({ schema }) => schema) returns the schema or
  undefined
- response schema: operation.toSuccessResponse()?.resolve().toSchema()
  ?? OasVoid.empty(), then materialize it through gen-zod via
  context.insertNormalizedModel(ZodProjection, { schema, fallbackName:
  `${this.name}Response`, destinationPath }) — it returns the DEFINITION;
  store its identifier name: this.zodName = definition.identifier.name.
  Do NOT hand-write schema text or imports — the engine registers and
  stitches everything.
EOF
    ;;
    method-render) cat <<'EOF'
CONTRACT for SLOT:method-render (body of toString(), indented four
spaces): return the rendered method source as a template literal
composed from the instance fields:
- signature: async <name>(<pathParams as `x: string`>..., plus
  `body: unknown` last when hasBody)
- body: `const res = await fetch(\`<templated path>\`, { method:
  '<VERB>' })` — use toPathTemplate(this.path) for the URL; include
  `body: JSON.stringify(body)` in the fetch init when hasBody
- return: `return <zodName>.parse(await res.json())`
Indent the rendered method so it nests correctly inside a class body
rendered at two-space indentation (method lines at two spaces, inner
statements at four).
EOF
    ;;
  esac
  echo
  echo "The full file containing the marker:"
  echo '```ts'
  case "$slot" in
    naming) cat gen-api-client/src/base.ts ;;
    *) cat gen-api-client/src/ClientMethod.ts ;;
  esac
  echo '```'
}

fill_slot() { # $1 slot, $2 model → writes slot output to .slots/$1.out, transcript to results
  local slot="$1" model="$2"
  slot_prompt "$slot" | claude -p --verbose --output-format stream-json --model "$model" \
    > "$RESULTS/slot-$slot.jsonl" 2>/dev/null || true
  node -e '
    const lines = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n")
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes("total_cost_usd")) {
        const r = JSON.parse(lines[i])
        let text = (r.result ?? "").trim()
        text = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
        require("fs").writeFileSync(process.argv[2], text + "\n")
        break
      }
    }
  ' "$RESULTS/slot-$slot.jsonl" ".slots/$slot.out"
}

splice() { # replace each marker with its slot file content
  node -e '
    const fs = require("fs")
    const targets = {
      "gen-api-client/src/base.ts": ["naming"],
      "gen-api-client/src/ClientMethod.ts": ["method-fields", "method-data", "method-render"]
    }
    for (const [file, slots] of Object.entries(targets)) {
      let text = fs.readFileSync(file + ".tpl", "utf8")
      for (const slot of slots) {
        const fill = fs.readFileSync(".slots/" + slot + ".out", "utf8").replace(/\n$/, "")
        text = text.replace("/*SLOT:" + slot + "*/", fill)
      }
      fs.writeFileSync(file, text)
    }
  '
}

# Keep pristine templates for re-splicing after slot repairs
cp gen-api-client/src/base.ts gen-api-client/src/base.ts.tpl
cp gen-api-client/src/ClientMethod.ts gen-api-client/src/ClientMethod.ts.tpl
mkdir -p .slots

T0=$(date +%s)

# ── Parallel fill ───────────────────────────────────────────────────────
for slot in naming method-fields method-data method-render; do
  fill_slot "$slot" "$FILL_MODEL" &
done
wait
splice
FILL_S=$(( $(date +%s) - T0 ))

run_verify() { rm -f gen-api-client/src/*.tpl.bak; deno task verify > "$1" 2>&1; }

set +e
run_verify "$RESULTS/verify1.log"; V1=$?
set -e
FIRST_PASS_GREEN=$([ $V1 -eq 0 ] && echo true || echo false)
ATTEMPTS=1

# ── Targeted repair: refill the implicated slot(s) with the error ──────
if [ $V1 -ne 0 ]; then
  ATTEMPTS=2
  ERR_TAIL=$(grep -m6 -A2 "TypeError\|Error:\|error\[" "$RESULTS/verify1.log" | head -30)
  # crude slot attribution: ClientMethod errors → refill its 3 slots; else naming
  if echo "$ERR_TAIL" | grep -q "base.ts"; then REPAIR_SLOTS="naming"; else REPAIR_SLOTS="method-fields method-data method-render"; fi
  for slot in $REPAIR_SLOTS; do
    { slot_prompt "$slot"; echo; echo "## Your previous fill FAILED verification with:"; echo "$ERR_TAIL"; echo "## Your previous fill was:"; cat ".slots/$slot.out"; echo "Reply with the corrected slot code only."; } \
      | claude -p --verbose --output-format stream-json --model "$REPAIR_MODEL" \
      > "$RESULTS/repair-$slot.jsonl" 2>/dev/null || true
    node -e '
      const lines = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n")
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes("total_cost_usd")) {
          const r = JSON.parse(lines[i])
          let text = (r.result ?? "").trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
          require("fs").writeFileSync(process.argv[2], text + "\n")
          break
        }
      }
    ' "$RESULTS/repair-$slot.jsonl" ".slots/$slot.out"
  done &
  wait
  splice
  set +e
  run_verify "$RESULTS/verify2.log"; V2=$?
  set -e
fi

WALL=$(( $(date +%s) - T0 ))

# ── Score, cost aggregation, archive ───────────────────────────────────
rm -f gen-api-client/src/*.tpl
set +e
node "$TASK2/score2.mjs" "$WORK" | tee "$RESULTS/score-summary.txt"
set -e
COST=$(node -e '
  const fs = require("fs"); let total = 0
  for (const f of fs.readdirSync(process.argv[1])) {
    if (!f.endsWith(".jsonl")) continue
    const lines = fs.readFileSync(process.argv[1] + "/" + f, "utf8").trim().split("\n")
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes("total_cost_usd")) { total += JSON.parse(lines[i]).total_cost_usd ?? 0; break }
    }
  }
  console.log(total.toFixed(3))
' "$RESULTS")
cp "$WORK/score.json" "$RESULTS/" 2>/dev/null || true
mkdir -p "$RESULTS/workspace"
rsync -a --exclude node_modules "$WORK/gen-api-client" "$WORK/out" "$RESULTS/workspace/" 2>/dev/null || true

echo "{\"arm\":\"scaffold\",\"runId\":\"$RUN_ID\",\"fillModel\":\"$FILL_MODEL\",\"repairModel\":\"$REPAIR_MODEL\",\"firstPassGreen\":$FIRST_PASS_GREEN,\"attempts\":$ATTEMPTS,\"wallSeconds\":$WALL,\"fillSeconds\":$FILL_S,\"warmupSeconds\":$WARM_S,\"totalCostUsd\":$COST}" > "$RESULTS/meta.json"
echo "── scaffold $RUN_ID: firstPassGreen=$FIRST_PASS_GREEN attempts=$ATTEMPTS wall=${WALL}s fill=${FILL_S}s cost=\$$COST"
