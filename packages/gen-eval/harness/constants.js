// Single source for the timeline/viewer instrumentation constants.
// thinking.js and timeline.js import these; viewer.js injects them
// into viewer.template.html at template-fill time — no hand-synced
// copies (the previous hand-synced pair had already drifted:
// "first bundle attempt" vs "first bundle").
//
// A block is "deep" if it stalls the run or reasons at plan scale.
// 60s is an order of magnitude above the typical few-second block and
// long enough to read as a stall in the terminal; 5000 tokens is past
// step-level deliberation. Either alone fires — a fast large block and
// a slow small one are both worth surfacing.
export const DEEP_THINK_SECONDS = 60
export const DEEP_THINK_TOKENS = 5000

// Milestone markers the timeline and viewer bracket a run with: the
// first write of each scaffold-critical file, and the first attempt
// at each loop-closing command.
export const MILESTONE_FILES = ['base.ts', 'mod.ts', 'enrichments.ts']
export const MILESTONE_CMDS = [
  ['skmtc bundle', 'first bundle attempt'],
  ['skmtc generate', 'first generate attempt'],
  ['gradle test', 'first test attempt']
]
