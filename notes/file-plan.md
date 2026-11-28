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

Measured again on main with ticket 5, with the three stock generators
(gen-typescript, gen-zod, gen-tanstack-query-fetch-zod), the document as
parsed JSON, and a sink that keeps nothing: the smallest V8 old space the
run completes in.

| document | without `onArtifact` | with it |
|---|---|---|
| Sentry | 102 MB | 82 MB |
| GitHub | 110 MB | 86 MB |
| Cloudflare | 268 MB | 205 MB |
| Microsoft Graph | 496 MB | 354 MB |

The run with `onArtifact` takes longer where the document is large: about
0.1 to 0.2 s more on Cloudflare in a run of 1.6 s, and about 0.4 s more on
Microsoft Graph in a run of 2.3 s. On GitHub nothing shows.

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
2. **Reach.** For each model, the models it reaches through `$ref`s, and for
   each operation or webhook, the models it names. Core reads it from the
   refs the parser read, each with its place (`ParseContext.toReach()`), and
   keys it by model key, so a deep ref target counts. It needs no walk of
   the document of its own.
3. **The file plan.** Before generate, for each file path: the subjects that
   hold it. A subject holds a file when a declared projection of its kind
   maps it there, or when the file has a model the subject names or a model
   that one reaches. The second part is what makes a later insert with other
   options, or a peer that reads a definition's value, safe: the file stays
   while any such subject is left. A subject of the plan is the `Subject`
   the run takes, so the two share one name for it. This step changes no
   behavior; it adds the plan and its tests. A file that no declared
   projection maps a subject to is not in the plan, and stays to the end.
4. **Subject order, and release.** The run goes subject by subject: for one
   subject, every generator. When the model generators are first in the
   config, three rules keep the output of the stock generators as it is
   today: the models in document order, the operations
   in document order, and an operation when each model up to the last one
   it can get to has run. A file that more than one generator inserts into
   can still change its order. A run generator by generator takes the kinds
   in the same order: the model generators, then the operation generators,
   then the webhook generators. An operation generator that the config lists
   first thus changes no file. When
   a file's last holder is done, core renders it, gives the text to the host
   and lets the file go. A write to such a file, or a lookup in one, is an
   error that names the subject and the file: it means a generator inserted
   a projection it did not declare.
5. **A sink.** `onArtifact(path, text)` on `toArtifacts`, called when a file
   is complete. It is what turns the plan on: a run without it is as today.
   With it, `artifacts` of the result is empty. Ideas 4 and 5 are one
   ticket.

**A run plans only when it releases.** The plan costs time: with the three
stock generators, about 30 ms for GitHub in a run of about 250 ms, and about
0.3 to 0.5 s for Microsoft Graph in a run of about 2 s (measured with ticket
3). So ticket 5 builds the plan for a run whose host asks for each file as
it is complete, and a run that does not ask goes generator by generator, as
today, with no plan.

A host that wants to write between subjects needs the run as steps: a
generator that stops after each subject. That is a seventh ticket, after these,
and only if a host asks for it.

## Patterns, in place of helper functions

The quick way to build this is free functions beside the code they change.
The same work fits three patterns core already has, and one it lacks.

- **Statics before construction.** The plan asks a projection class where a
  subject's file is, with the statics the Drivers use today. No new way to
  name a file is added.
- **One ref walk.** Reach reads the refs the parser kept while it read the
  document. It adds no walk of its own, no list of HTTP methods and no
  pointer decoding.
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
  different orders. The bar for ticket 5 was the same bytes for every stock
  generator on the documents in `core/_schemas`, and it is met: each of the
  18 stock generators alone and 7 stacks of them, on those six documents and
  on Sentry and GitHub. Of 200 pairs, 163 were compared, about 104,700
  files, and none differs; in 37 the run fails both ways. The first order
  tried ran an operation as soon as its models had run. It changed the
  order of the entries in a file that every operation adds to, which seven
  stock generators have; the rule for operations in document order ends
  that.
- **What the three rules do not promise.** Two generators that write one
  file have their definitions in the run's order of generators when both
  get to a model from the same first subject. A generator that gets to a
  model from an earlier subject than another one does would put its
  definition first. No stock generator does.
- **A run that fails after it gave files.** A run generator by generator
  that fails writes nothing. A run with a sink has given files by then. The
  host drops them, and the run gives no more after the first subject that
  fails.
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
| 2 | Reach, from the refs the parser read | no | one module in `parse/` with tests |
| 3 | The file plan | no | one module with tests; nothing in a run builds the plan yet |
| 4 | One `Subject` type and one runner for the four kinds | no | a refactor of `GenerateContext`'s four run loops; deep review |
| 5 and 6 | Subject order and release, for a run that is given `onArtifact` | adds an option; a run without it is as today | the large one; deep review |

- Each ticket leaves main releasable, with no switch that exists only to
  bridge two tickets.
- Ticket 5 adds the permanent check: a test in core's suite that runs a
  document planned and unplanned and compares every file's bytes.
- Tickets 1 to 4 give no gain by themselves. The gain arrives with 5.
- Ticket 4 was built before ticket 3, which takes its `Subject`.
- Each ticket carries its patch and its tests.

## Verified with ticket 3

- **The plan against real runs.** With the three stock generators
  (gen-typescript, gen-zod, gen-tanstack-query-fetch-zod) and their lists,
  on Sentry, GitHub, Cloudflare and Microsoft Graph: every file of the run
  is in the plan, and no subject reads or writes a planned file that the
  plan does not give it. Microsoft Graph made 446,096 reads and writes of
  22,601 files.
- **`toExportPath` of the stock projections** needs only the subject, the
  enrichments and the variant, but for two generators. gen-effect-schema's
  `coerce` option adds a suffix to the name, and the path follows the name:
  the plan asks with no options, so it knows the file of the JSON reading
  only, and the file of a coerced twin stays to the end. gen-md-docs takes
  the path of a document from an option, so it has no list.
- **A projection that cannot answer is left out for that subject.** A static
  that throws, or enrichments with variants and no `main`: the run reports
  the fault where it happens, and the plan counts it (`unanswered`).
- **The plan's reads of enrichments are not recorded** in the enrichment
  audit. The plan reads for projections the run may never insert.

## Not verified yet

Each of these is checked when its ticket is written, and the note is
corrected if it does not hold.

- How webhooks map to files in a real generator. The plan gives a webhook
  the operation rule; no stock generator takes webhooks, so no run has
  checked it.
- A run with `onArtifact` and attribution. It gives every file at the end
  today. Whether a file can be captured when it is given is not looked at.
