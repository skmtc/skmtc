# Check 8 — toString() is pure

**Verdict:** pass/fail (`pure` column).

## What it asserts

No `toString()` body (including arrows nested inside it):

- assigns to a `this.*` path (any assignment operator, `++`-style
  excluded only because it doesn't survive the assignment-token range),
- mutates a `this.*` path via `push`/`add`/`set`/`unshift`/`splice`/
  `delete`,
- calls the register family (`register`, `registerInto`,
  `insertOperation`, `insertModel`, `insertNormalizedModel`,
  `defineAndRegister`), or
- **constructs anything** (`new X(…)` — a `KtParameterList` wrap, a
  snippet, an `Error`). The render tree is built at construction
  time; `toString()` only reads and interpolates settled state.
  Refusals throw from the constructor (fail at generate), never from
  render.

## Why

`toString()` runs multiple times — Render, previews, integrity checks —
and must be a pure function of state set in the constructor. Mutation
produces output that differs between calls; a register call from
toString lands after Render has finalised the file's imports and is
silently lost. This is a load-bearing invariant of the
constructor/toString contract.

## How it is measured

During the shared AST pass, every assignment, this-rooted mutator call,
register-family call, and `new` expression is checked against the
enclosing-function stack; violations record class, file, line, kind
(`assignment`/`mutation`/`register-call`/`construction`) and a detail
string.

## Reading the result

Expected: `ok` — the entire stock baseline passes, including the
otherwise sub-par generators. Any FAIL in harness output is a
first-order bug in the authored generator, not a style issue.

## Known exceptions

None. Memoize-on-first-call patterns (`this.cached ??= …` inside
toString) are also violations by this rule — compute in the
constructor instead.
