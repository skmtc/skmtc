#!/usr/bin/env bash
# Runtime gates over a harness workspace. Ground truth only — no
# judged scoring. Usage: gates.sh <workspace-dir> <out-dir>
set -uo pipefail

WORKSPACE=${1:?usage: gates.sh <workspace-dir> <out-dir>}
OUT=${2:?usage: gates.sh <workspace-dir> <out-dir>}
HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
GEN_EVAL="$HARNESS_DIR/.."
mkdir -p "$OUT"
cd "$WORKSPACE"

REPORT="$OUT/report.md"
PASS_COUNT=0
FAIL_COUNT=0

note() { echo "$1" >> "$REPORT"; }
gate() { # gate <name> <ok|FAIL|skip> <detail>
  if [ "$2" = ok ]; then PASS_COUNT=$((PASS_COUNT + 1)); fi
  if [ "$2" = FAIL ]; then FAIL_COUNT=$((FAIL_COUNT + 1)); fi
  note "| $1 | $2 | $3 |"
}

echo "# Harness gates — $(basename "$(dirname "$OUT/x")")" > "$REPORT"
note ""
note "| gate | result | detail |"
note "|---|---|---|"

# Gate 0 — integrity: the acceptance tests were not touched
if shasum -a 256 -c .harness-checksums > "$OUT/integrity.log" 2>&1; then
  gate integrity ok "test + build files untouched"
else
  gate integrity FAIL "checksum mismatch — see integrity.log (run disqualified)"
fi

# Gate 0b — contamination audit: no tool call reached into forbidden
# paths (other generator implementations, demo apps, previous runs).
# Scans tool_use INPUTS in the transcript — deny rules alone cannot
# stop Bash reads under skip-permissions, so this is the enforcement.
SKMTC_ROOT=$(cd "$HARNESS_DIR/../../../.." && pwd)
if [ -f "$OUT/transcript.jsonl" ]; then
  AUDIT=$(python3 - "$OUT/transcript.jsonl" "$SKMTC_ROOT" <<'EOF'
import json, sys
forbidden = [
    f"{sys.argv[2]}/skmtc-generators",
    f"{sys.argv[2]}/.skmtc",
    f"{sys.argv[2]}/kotlin-demos",
    f"{sys.argv[2]}/kotlin-spring-demo",
    f"{sys.argv[2]}/csharp-demos",
    "harness/runs/"
]
hits = []
with open(sys.argv[1]) as transcript:
    for line in transcript:
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        content = (event.get('message') or {}).get('content')
        if not isinstance(content, list):
            continue
        for item in content:
            if isinstance(item, dict) and item.get('type') == 'tool_use':
                payload = json.dumps(item.get('input', {}))
                for path in forbidden:
                    if path in payload:
                        hits.append(f"{item.get('name')}: …{path.split('/')[-1]}")
if hits:
    print(f"FAIL|{len(hits)} forbidden access(es): {'; '.join(sorted(set(hits))[:4])}")
else:
    print("ok|no tool call touched forbidden paths")
EOF
)
  gate contamination "${AUDIT%%|*}" "${AUDIT#*|}"
else
  gate contamination skip "no transcript.jsonl in out dir"
fi

# Gate 1 — clean regenerate from the bundle (catches hand-written output)
skmtc clean lab --json > "$OUT/clean.json" 2>&1
skmtc generate lab --json > "$OUT/generate.json" 2>&1
GEN_SUMMARY=$(python3 - "$OUT/generate.json" <<'EOF'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception as error:
    print(f"FAIL|unparseable generate output: {error}")
    raise SystemExit
if data.get('type') != 'generated' or data.get('errors'):
    print(f"FAIL|type={data.get('type')} errors={data.get('errors')}")
else:
    kotlin_files = [f for f in data.get('files', []) if f.endswith('.kt')]
    print(f"ok|{len(kotlin_files)} kotlin file(s)")
EOF
)
gate generate "${GEN_SUMMARY%%|*}" "${GEN_SUMMARY#*|}"

# Gate 2 — schema coverage: one file per components.schemas entry
COVERAGE=$(python3 - <<'EOF'
import json, os
schemas = list(json.load(open('openapi.json'))['components']['schemas'])
produced = set()
for root, _dirs, files in os.walk('consumer/src/main/kotlin'):
    for name in files:
        if name.endswith('.kt'):
            produced.add(name.split('.')[0])
missing = [s for s in schemas if s not in produced]
if missing:
    print(f"FAIL|missing {len(missing)}/{len(schemas)}: {', '.join(missing[:6])}")
else:
    print(f"ok|all {len(schemas)} schemas covered")
EOF
)
gate schema-coverage "${COVERAGE%%|*}" "${COVERAGE#*|}"

# Gate 3 + 4 — Kotlin compiles, round-trip tests pass
if [ -f consumer/gradle.properties ] && command -v gradle > /dev/null; then
  if (cd consumer && gradle -q compileKotlin --console=plain) > "$OUT/compile.log" 2>&1; then
    gate compile ok "gradle compileKotlin"
    if (cd consumer && gradle -q test --console=plain) > "$OUT/test.log" 2>&1; then
      gate round-trip ok "gradle test"
    else
      gate round-trip FAIL "see test.log"
    fi
  else
    gate compile FAIL "see compile.log"
    gate round-trip skip "compile failed"
  fi
else
  gate compile skip "no JDK/gradle available"
  gate round-trip skip "no JDK/gradle available"
fi

# Structural eval over the authored generator
node "$GEN_EVAL/src/cli.ts" --scan .skmtc/lab \
  --json "$OUT/structural.json" --md "$OUT/structural.md" > "$OUT/structural.txt" 2>&1
VERDICT=$(python3 - "$OUT/structural.json" <<'EOF'
import json, sys
try:
    reports = json.load(open(sys.argv[1]))
    if not reports:
        print('no generator found')
    else:
        aggregate = reports[0]['aggregate']
        extra = f" — failed: {', '.join(aggregate['failedChecks'])}" if aggregate['failedChecks'] else ''
        print(f"{aggregate['verdict']} ({aggregate['warningCount']} warnings){extra}")
except Exception as error:
    print(f'unavailable: {error}')
EOF
)
note ""
note "**Structural eval:** $VERDICT (details: structural.md)"
note ""
note "Gates passed: $PASS_COUNT, failed: $FAIL_COUNT."
note ""
note "Diagnosis order: report.md -> structural.md -> generate.json ->"
note "test.log -> transcript.jsonl (search for the Skill invocation and"
note "the first Write of base.ts to see where the model's plan diverged)."

cat "$REPORT"
[ "$FAIL_COUNT" -eq 0 ]
