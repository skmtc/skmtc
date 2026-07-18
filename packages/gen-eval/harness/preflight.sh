#!/usr/bin/env bash
# Toolchain preflight: prove that bundle + generate + the lang
# register()/addFile contract all work in a throwaway workspace BEFORE
# any agent minutes are spent. Catches environment skew (e.g. a
# vendored lang-kotlin relying on unpublished @skmtc/core behavior,
# a stale CLI/worker pin) that would otherwise surface mid-run as a
# misleading generator bug. Usage: preflight.sh
set -euo pipefail

HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
PF_WS=$(mktemp -d "${TMPDIR:-/tmp}/gen-eval-preflight.XXXXXX")
cleanup() { rm -rf "$PF_WS"; }
trap cleanup EXIT

bash "$HARNESS_DIR/seed.sh" "$PF_WS" > /dev/null
cd "$PF_WS"

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
import type { ModelProjectionArgs } from '@skmtc/core'
import { toKtModelProjectionBase } from '@skmtc/lang-kotlin'

const PreflightBase = toKtModelProjectionBase({
  id: '@eval/gen-preflight',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'typealias' }),
  toExportPath: () => '@/com/example/preflight/Preflight.kt',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class PreflightModel extends PreflightBase {
  constructor(args: ModelProjectionArgs) {
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
