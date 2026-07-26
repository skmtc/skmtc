// Single source for the deep-think thresholds. thinking.js and
// timeline.js import these; viewer.js injects them into
// viewer.template.html at template-fill time — no hand-synced copies.
//
// A block is "deep" if it stalls the run or reasons at plan scale.
// 60s is an order of magnitude above the typical few-second block and
// long enough to read as a stall in the terminal; 5000 tokens is past
// step-level deliberation. Either alone fires — a fast large block and
// a slow small one are both worth surfacing.
export const DEEP_THINK_SECONDS = 60
export const DEEP_THINK_TOKENS = 5000
