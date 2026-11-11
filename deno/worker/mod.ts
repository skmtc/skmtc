/**
 * `@skmtc/worker` re-exports the worker entry that now ships with core as
 * `@skmtc/core/worker` (#333). The CLI imports it from the project's own
 * core, so the core that runs is the one the generator stack pins. This
 * package stays for CLIs that still write `import toWorker from
 * '@skmtc/worker'` into a project's `worker.ts`.
 */
export { buildAttributionState, default } from '@skmtc/core/worker'

export type {
  DescribePayload,
  GeneratePayload,
  SerializableAttribution,
  WorkerDescribeResult,
  WorkerMessage,
  WorkerResult
} from '@skmtc/core/worker'
