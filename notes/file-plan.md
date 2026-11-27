# Design: a file plan in core, and each file released when it is complete

Status: agreed by the owner on 2026-11-27. Written against main at
`a78040a0` (core 0.50.0). The work is six tickets, listed below; this note is
the one description of where they end, and each ticket corrects it when it
finds something the note has wrong.

## The goal

A run holds every generated file until the end. With a plan of which
subjects can write to or read from each file, core can render a file as soon
as no later subject needs it, give its text to the host, and let its
definitions go.

Measured in an experiment on core 0.45, with the plan and release as the
only change: the smallest heap a run fits in went from 102 MB to 79 MB on
GitHub, 82 MB to 63 MB on Sentry, and 291 MB to 205 MB on Cloudflare, with
the same output byte for byte.

Microsoft Graph was not in that measurement. On released core 0.48.0, a
whole run of it with the three stock generators needs a heap of about
476 MB (measured 2026-11-27 with a script that also holds all the output, so
the figure is somewhat high). Ticket 5 measures the plan's own gain on
Microsoft Graph, on main.

Not goals of this work: building operations and schemas only when they are
read, one parse for each operation, and anything a host can do with its own
reader of the document. They are later work, and each stands on this.

## What main does today

- **Order.** `GenerateContext.toArtifacts` runs generator by generator
  (`#runGenerator`). Each generator runs all its subjects: OpenAPI
  operations, webhooks, GraphQL operations or models.
- **Files.** Every file stays in the context's file map until generate ends.
  `RenderContext` then renders all of them.
- **Entries.** An entry has `transform`, `isSupported` and
  `toEnrichmentSchema`. It does not say which projections it inserts, so
  core cannot know a generator's files before it runs.
- **Refs.** Parse already walks the document's `$ref`s once, with the rules
  for data keywords and maps of schemas (`parse/toCyclicRefs.ts`).

## The end state

Five ideas, each with one home. The tickets are listed further down.

1. **An entry declares its projections.** `projections: [ZodProjection]` on
   the entry config. The list has every projection class the generator can
   insert: its own, and each one of another generator that it inserts, since
   that generator may not be in the run by itself. Core reads only statics from them (`toEnrichments`,
   `toExportPath`), which exist today and construct nothing. An entry with
   no `projections` is not planned, and its files render at the end, as now.
   So a generator joins when its author adds one line.
2. **Reach.** For each subject, the models it can reach through `$ref`s,
   and for each model, the models it reaches. Core computes it from the
   document in `parse/`, from the same walk as the cycle check, and keys it
   by model key, so a deep ref target counts.
3. **The file plan.** Before generate, for each file path: the subjects that
   hold it. A subject holds a file when one of its own projections maps it
   there, or when the file has a model the subject reaches. The second part
   is what makes a later insert with other options, or a peer that reads a
   definition's value, safe: the file stays while any such subject is left.
   This step changes no behavior; it adds the plan and its tests.
4. **Subject order, and release.** The run goes subject by subject: for one
   subject, every generator. Two rules keep the output as it is today:
   models in document order, and an operation after the models it reaches.
   When a file's last holder is done, core renders it, keeps the text and
   drops the definitions. A write to a released file, or a lookup in one, is
   an error that names the generator, the subject and the file: it means a
   generator inserted a projection it did not declare.
5. **A sink.** `onArtifact(path, text)` on `toArtifacts`, called at release.
   Without it the text stays in memory and the result is as today.

A host that wants to write between subjects needs the run as steps: a
generator that stops after each subject. That is a seventh ticket, after these,
and only if a host asks for it.

## Patterns, in place of helper functions

The quick way to build this is free functions beside the code they change.
The same work fits three patterns core already has, and one it lacks.

- **Statics before construction.** The plan asks a projection class where a
  subject's file is, with the statics the Drivers use today. No new way to
  name a file is added.
- **One ref walk.** Reach is a second reader of the graph that the cycle
  check builds in `parse/toCyclicRefs.ts`. It adds no walk of its own, no
  list of HTTP methods and no pointer decoding.
- **A class for a thing that has state.** `Reach` and `FilePlan` are two
  small classes, each with its tests: what holds a file, and which files a
  finished subject releases. `GenerateContext` asks them; it does not grow
  the logic itself.
- **Missing today: one shape for a subject.** `GenerateContext.ts` is 2,337
  lines, and has four run loops that do the same steps for four kinds of
  subject (`#runOasOperationGenerator` 113 lines, `#runWebhookGenerator`
  105, `#runModelGenerator` 101, `#runGqlOperationGenerator` 60): the
  filters, `isSupported`, the variants, the result. Subject order needs one
  step that runs one subject in every generator. Written as a fifth loop it
  would copy the four. So a ticket before the order change gives the four
  kinds one `Subject` type and one runner, with a `switch` on the kind only
  where the kinds differ. It changes no behavior, and it is where the order
  change then has one place to go.

## What stays out

- Reach passed in by the host. Core computes it. Whether a host may pass
  its own is a later question; these tickets do not add the parameter.
- A cache that stands in for a value computed once, where it enters the
  engine.
- Any limit on what a run keeps that trades time for memory.

## Risks, each with how the tickets answer it

- **A file that several generators write keeps its definitions in the order
  they were inserted.** Generator by generator and subject by subject give
  different orders. The two order rules gave the same bytes for the three
  stock generators on three documents. The bar for ticket 5 is the same
  bytes for every stock generator on the documents in `core/_schemas`.
  Where a stack cannot meet it, the ticket stops and the owner decides.
- **A generator that writes one file from every subject** (an accumulator,
  such as a docs page) can never release that file early. It is not planned,
  and the run reports it once, so the author knows why memory is not saved.
- **Attribution and inspection read definitions at the end.** A run with
  `inspect`, and the capturing render of a run with attribution, need a
  check each: either release happens after the capture of that file, or
  such a run does not release. Ticket 5 decides it from the code and says
  which.
- **GraphQL input** has no `$ref` reach. Its operations are not planned in
  these tickets and render at the end.
- **The cycle rule.** Reach has to treat a cycle as one set, and the order
  rule "models in document order" matters for a cycle today. skmtc#432 and
  skmtc-generators#129 remove that dependence; this work starts after both.

## The tickets

| # | Ticket | Changes behavior | Size |
|---|---|---|---|
| 1 | Entries declare projections, and each stock generator does | no | core small; every stock generator one line and a release |
| 2 | Reach, from the document | no | one module in `parse/` with tests |
| 3 | The file plan | no | one module with tests; the plan is built and not used |
| 4 | One `Subject` type and one runner for the four kinds | no | a refactor of `GenerateContext`'s four run loops; deep review |
| 5 | Subject order and release | yes: order of work, peak memory | the large one; deep review |
| 6 | `onArtifact` | adds an option | small |

- Each ticket leaves main releasable, with no switch that exists only to
  bridge two tickets.
- Ticket 5 adds the permanent check: a test in core's suite that runs a
  document planned and unplanned and compares every file's bytes.
- Tickets 1 to 4 give no gain by themselves. The gain arrives with 5.
- Each ticket carries its patch and its tests.

## Not verified yet

Each of these is checked when its ticket is written, and the note is
corrected if it does not hold.

- That `toExportPath` of every stock projection needs nothing but the
  subject, the enrichments and the variant on main (caller options became
  part of identity in 0.4x, and a projection with options may map one
  subject to several paths).
- How webhooks map to files, and whether they fit the operation rule.
- The figures above are from core 0.45. Ticket 5 measures again on main.
