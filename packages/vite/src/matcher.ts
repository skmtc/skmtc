// The server-side input matcher, exported for hosts OTHER than this plugin —
// concretely the skmtc-hub preview container's harness, which mounts the same
// `POST /input-matches` next to the project's real node_modules. NODE-ONLY:
// unlike `./wire` (schemas the browser bundles), this graph reaches the
// filesystem, spawns the skmtc CLI, and loads the project's TypeScript — do
// not import it from browser code.
//
// The pieces:
// - `SourceState` — the per-project cache that owns the TS language service,
//   the schema/candidates/gen-map reads and the match memo; hosts construct
//   one per project root, `attach()` a watcher, call `match()`, and signal
//   `onGenerateSuccess()` after a regenerate.
// - `runDescribe` + `moduleTypeFromDescribe` — the describe-based
//   `resolveModuleType` a host wires into `SourceStateOptions` when a local
//   bundle exists; a remote-mode host (no bundle) resolves the deployed
//   stack's `/descriptors` instead and maps it through the same helper shape.

export { SourceState, type MatchRequest, type SourceStateOptions } from './source-state.ts'
export {
  matchInputs,
  type MatchArgs,
  type MatcherService,
  type MatcherSubject
} from './input-matcher.ts'
export { moduleTypeFromDescribe } from './descriptors.ts'
export { runDescribe, runGenerate, type CliResult } from './skmtc-cli.ts'
