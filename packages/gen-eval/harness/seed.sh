#!/usr/bin/env bash
# Seed a fresh, isolated SKMTC workspace for a gen-kotlin-jackson
# authoring run. Usage: seed.sh <workspace-dir>
set -euo pipefail

WORKSPACE=${1:?usage: seed.sh <workspace-dir>}
HARNESS_DIR=$(cd "$(dirname "$0")" && pwd)
ASSETS="$HARNESS_DIR/assets"
# harness/ -> gen-eval -> packages -> skmtc -> skmtc-root
SKMTC_ROOT=$(cd "$HARNESS_DIR/../../../.." && pwd)
LANG_KOTLIN="$SKMTC_ROOT/skmtc/deno/lang-kotlin"

[ -d "$LANG_KOTLIN" ] || { echo "lang-kotlin not found at $LANG_KOTLIN" >&2; exit 1; }

mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# 1. SKMTC project + pinned schema
skmtc init lab consumer/src/main/kotlin --json > /dev/null
cp "$ASSETS/openapi.json" openapi.json
python3 - <<'EOF'
import json
path = '.skmtc/lab/.settings/client.json'
config = json.load(open(path))
config['source'] = './openapi.json'
json.dump(config, open(path, 'w'), indent=2)
EOF

# 2. Vendored lang-kotlin (pre-alpha; not on public JSR) as a workspace
#    member, wired into the project import map
cp -R "$LANG_KOTLIN" .skmtc/lab/lang-kotlin
python3 - <<'EOF'
import json
path = '.skmtc/lab/deno.json'
config = json.load(open(path))
config.setdefault('imports', {})
config['workspace'] = ['./lang-kotlin']
json.dump(config, open(path, 'w'), indent=2)
EOF

# 3. Consumer gradle app (compile + round-trip acceptance tests)
mkdir -p consumer/src/main/kotlin consumer/src/test/kotlin
cp "$ASSETS/build.gradle.kts" consumer/build.gradle.kts
cp "$ASSETS/settings.gradle.kts" consumer/settings.gradle.kts
cp "$ASSETS/RoundTripTest.kt" consumer/src/test/kotlin/RoundTripTest.kt

# Point gradle at a JDK (homebrew openjdk@21 preferred; else java_home)
JDK_HOME=""
if [ -d /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ]; then
  JDK_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
elif JH=$(/usr/libexec/java_home -v 17+ 2>/dev/null); then
  JDK_HOME=$JH
fi
if [ -n "$JDK_HOME" ]; then
  echo "org.gradle.java.home=$JDK_HOME" > consumer/gradle.properties
else
  echo "WARN: no JDK >=17 found — the compile/test gate will be skipped" >&2
fi

# 4. Integrity checksums — the gates disqualify a run that edits these
shasum -a 256 \
  consumer/src/test/kotlin/RoundTripTest.kt \
  consumer/build.gradle.kts \
  consumer/settings.gradle.kts \
  openapi.json > .harness-checksums

echo "seeded: $WORKSPACE"
