#!/usr/bin/env bash
# Toolchain preflight: prove that bundle + generate + the lang
# register()/addFile contract all work in a throwaway workspace BEFORE
# any agent minutes are spent. Catches environment skew (e.g. a
# vendored lang-kotlin relying on unpublished @skmtc/core behavior,
# a stale CLI/worker pin) that would otherwise surface mid-run as a
# misleading generator bug. Usage: preflight.sh
set -euo pipefail

HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
# Workspace root = parent of the MAIN skmtc checkout, derived via git so
# harness runs from a linked worktree resolve correctly (the plain
# ../../../.. default landed inside .claude/worktrees/).
. "$HARNESS_DIR/skmtc-root.sh"

# A dirty kotlin-person-api contaminates the run: seed.sh copies the
# WORKING TREE, so uncommitted state silently becomes the app + the
# reference/Dtos.kt every diff is judged against, and personApiSha in
# meta.json stops describing what actually ran.
if [ "${ALLOW_DIRTY:-0}" != "1" ] && [ -n "$(git -C "$SKMTC_ROOT/kotlin-person-api" status --porcelain 2>/dev/null)" ]; then
  echo "preflight FAILED: kotlin-person-api working tree is dirty — commit or" >&2
  echo "stash first (the seeded app + reference/Dtos.kt would embed uncommitted" >&2
  echo "state), or rerun with ALLOW_DIRTY=1 to accept it knowingly." >&2
  exit 1
fi

PF_WS=$(mktemp -d "${TMPDIR:-/tmp}/gen-eval-preflight.XXXXXX")
cleanup() { rm -rf "$PF_WS"; }
trap cleanup EXIT

bash "$HARNESS_DIR/seed.sh" "$PF_WS" > /dev/null
cd "$PF_WS"

# Scaffolder-shape probe: the agent's first act is `skmtc create …
# --lang kotlin`, and the CLI on PATH is a compiled binary — a stale
# one silently seeds the run with an outdated skeleton (run
# 20260720-192026: a Jul-18 binary emitted the pre-router KtType
# shape; the agent burned its first phase undoing it and read the
# structural-eval source to arbitrate the contradiction). Scaffold a
# throwaway generator and assert the router-skeleton shape.
cp .skmtc/lab/deno.json "$PF_WS/deno.json.pre-probe"
skmtc create lab @eval/gen-shape-probe model --lang kotlin > /dev/null
PROBE=.skmtc/lab/gen-shape-probe
if [ ! -f "$PROBE/src/Kt.ts" ] \
  || ! grep -q "TypeSystemArgs<SchemaType>" "$PROBE/src/Kt.ts" \
  || ! grep -q "KtValueFields" "$PROBE/src/Kt.ts" \
  || ! grep -q "toKtValue" "$PROBE/src/Kt.ts" \
  || [ -f "$PROBE/src/KtType.ts" ] \
  || [ ! -f "$PROBE/src/StringValue.ts" ] \
  || [ ! -f "$PROBE/src/RefValue.ts" ] \
  || [ ! -f "$PROBE/src/protocol.ts" ]; then
  echo "preflight FAILED: installed skmtc scaffolds a stale kotlin skeleton" >&2
  echo "(want src/Kt.ts with a plain-signature toKtValue router, one module" >&2
  echo "per scaffolded router case incl. StringValue.ts/RefValue.ts, a" >&2
  echo "src/protocol.ts declaring KtValueFields, and no KtType.ts)." >&2
  echo "Recompile the CLI from current source" >&2
  echo "(cli/CLAUDE.md, 'Installing the CLI from local source') and rerun." >&2
  ls "$PROBE/src" >&2 2>/dev/null || true
  exit 1
fi
# The skeleton's claim is "bundles AND type-checks" — bundle/generate run
# esbuild (no typecheck), so only an explicit deno check verifies the
# second half (run 20260720-214151: a bare ModelProjectionArgs
# constructor rode green gates all the way to a manual check). Must run
# from inside the project dir so the workspace import map applies.
if ! (cd .skmtc/lab && deno check gen-shape-probe/mod.ts) > "$PF_WS/probe-check.log" 2>&1; then
  echo "preflight FAILED: the scaffolded kotlin skeleton does not type-check" >&2
  tail -20 "$PF_WS/probe-check.log" >&2
  exit 1
fi
rm -rf "$PROBE"
mv "$PF_WS/deno.json.pre-probe" .skmtc/lab/deno.json

# A minimal Kotlin model generator. The constructor register() call is
# deliberate: it writes an import into the projection's own file BEFORE
# the Driver has created it, exercising the lang register()'s
# getFile-??-addFile path — the exact seam that breaks when the
# vendored lang layer and the pinned core disagree on addFile's return.
mkdir -p .skmtc/lab/gen-preflight
cat > .skmtc/lab/gen-preflight/deno.json <<'EOF'
{
  "name": "@eval/gen-preflight",
  "version": "0.0.1",
  "exports": "./mod.ts",
  "imports": {}
}
EOF
cat > .skmtc/lab/gen-preflight/mod.ts <<'EOF'
import { emptyEnrichmentSchema, toModelEntry } from '@skmtc/core'
import type { EmptyEnrichments, ModelProjectionArgs } from '@skmtc/core'
import { toKtModelProjectionBase } from '@skmtc/lang-kotlin'

const PreflightBase = toKtModelProjectionBase({
  id: '@eval/gen-preflight',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'typealias' }),
  toExportPath: () => '@/com/example/preflight/Preflight.kt',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PreflightModel extends PreflightBase {
  constructor(args: ModelProjectionArgs<EmptyEnrichments>) {
    super(args)

    this.register({
      imports: { 'com.example.preflight.support': ['Support'] }
    })
  }

  toString(): string {
    return 'String'
  }
}

export default toModelEntry({
  id: '@eval/gen-preflight',
  transform({ context, refName }) {
    context.insertModel(PreflightModel, refName)
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})
EOF

node - <<'EOF'
const { readFileSync, writeFileSync } = require('node:fs')
const path = '.skmtc/lab/deno.json'
const config = JSON.parse(readFileSync(path, 'utf8'))
config.imports = config.imports ?? {}
config.imports['@eval/gen-preflight'] = './gen-preflight/mod.ts'
config.workspace = [...(config.workspace ?? []), './gen-preflight']
writeFileSync(path, JSON.stringify(config, null, 2))
EOF

skmtc bundle lab --json > /dev/null
skmtc generate lab --json > generate.json

ARTIFACT=$(find kotlin-person-api/src/main/kotlin/com/example/preflight -name '*.kt' 2>/dev/null | head -1 || true)
if [ -z "$ARTIFACT" ]; then
  echo "preflight FAILED: generate produced no Kotlin artifact" >&2
  echo "--- generate.json tail ---" >&2
  tail -c 2000 generate.json >&2 || true
  exit 1
fi

ERRORS=$(node -e '
  const fs = require("node:fs")
  try {
    const out = JSON.parse(fs.readFileSync("generate.json", "utf8"))
    const errors = out.errors ?? out.manifest?.errors ?? []
    console.log(Array.isArray(errors) ? errors.length : 0)
  } catch { console.log("unparseable") }
')
if [ "$ERRORS" != "0" ]; then
  echo "preflight FAILED: generate reported errors ($ERRORS)" >&2
  tail -c 2000 generate.json >&2 || true
  exit 1
fi

echo "preflight: toolchain OK ($ARTIFACT)"
