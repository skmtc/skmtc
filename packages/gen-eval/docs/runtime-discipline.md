# Check 14 — Valid synchronous Deno; side effects are logs + registers

**Verdict:** pass/fail (`runtime` column).

## What it asserts

Generator code runs inside a sandboxed Deno Worker, synchronously. The
only legitimate side effects are logging and the register/insert
family. Everything else is flagged, by category:

- **node-ism** — `process.*` (use `Deno.env.get`), `require(…)`
- **fs** — `Deno.` file operations (`writeTextFile`, `readTextFile`,
  `mkdir`, `remove`, …; `Deno.env` is allowed) and `node:fs` imports.
  Output flows through `register`, never the filesystem; a file written
  directly is invisible to `findDefinition`, the artifacts payload, the
  manifest, and cleanup
- **network** — `fetch(…)`, `new WebSocket`, `new XMLHttpRequest`. The
  worker runs with `net: false`; generators have no outbound network by
  design
- **timer** — `setTimeout` / `setInterval`
- **async** — `async` functions, `await` expressions, `new Promise`,
  and `.then/.catch/.finally(callback)` calls. The generate loop is
  synchronous; `transform` and every producer constructor must complete
  synchronously

## How it is measured

AST-level detection during the shared pass. This matters: emitted code
is often legitimately async (`await fetch(…)` inside a tanstack-query
hook template), but that text lives inside template literals where it
is not an AST construct — only real constructs in generator source are
flagged. The `.then` family requires a function-valued argument to
avoid false positives. Scope is the code the bundle executes: root
entry files plus `src/**` — `demo/`, `scripts/`, and test files are
excluded (a demo runner legitimately awaits and reads files).

## Reading the result

Expected: `ok` — the entire stock baseline passes. Violations in
harness output are ordered worth fixing first: an `async transform` or
a `fetch` means the author misunderstood the execution model, not just
a style rule.

## Known exceptions

None in pipeline code. If a lang package ever exposes an async seam
this check will need revisiting; today none does.
