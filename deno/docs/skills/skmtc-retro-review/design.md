# skmtc-retro-review skill — design document

> The loadable skill is [`SKILL.md`](SKILL.md); the slash command is
> [`commands/skmtc-retro-review.md`](commands/skmtc-retro-review.md).

## Purpose

Turn accumulated per-session observations into decisions. The
`skmtc-retro` skill is the sensor — it captures what went wrong
session by session. The `skmtc-retro-review` skill is the actuator —
it aggregates observations across sessions, identifies systemic
patterns, classifies each pattern by the best intervention type, and
produces a prioritized action plan with falsifiable success criteria.

Without this skill, the friction log is a cemetery: observations
accumulate but nothing systematically improves. The review is where
"is it getting better?" becomes empirically answerable.

## Audience

The user (Dmitri), running the review periodically. Not intended for
invocation during active SKMTC work — it's a reflection-and-decision
tool run at session boundaries or on a monthly/pre-release cadence.

## Triggers

- "review retros" / "review friction"
- "run a retro review"
- "what's the pattern across sessions"
- "what should we fix next"
- Slash command: `/skmtc-retro-review [period]`
- Monthly cadence, or before a release

## Relationship to skmtc-retro

| | skmtc-retro | skmtc-retro-review |
|---|---|---|
| **Timescale** | Per session | Monthly / pre-release |
| **Input** | Session content | Friction log files |
| **Output** | Session file in `friction-log/` | Review file in `friction-log/reviews/` |
| **Primary question** | What happened in this session? | Is the system getting better? |
| **Action** | Captures observations | Produces decisions |

The two skills form a closed loop: retro → friction log → review →
action plan → interventions → reduced future friction → fewer retro
entries.

## Scope boundary

### In skill

- Reading strategy for the friction log (Index-first, body on demand)
- Clustering rules: group by root cause, not surface topic; state
  hypothesis explicitly; 2+ entries required for a cluster
- The intervention decision tree and all 9 intervention types
- Convergence metrics: FRR, Blocker%, open entry accumulation,
  knowledge backlog, resolution velocity
- Review file format (summary → prior follow-up → clusters → action
  plan → knowledge backlog → metrics history)
- Specificity requirement for action plan entries
- Prior-action follow-up procedure (verify completion + recurrence)

### Deferred

- Per-session entry format: [`skmtc-retro SKILL.md`](../skmtc-retro/SKILL.md)
- Friction log file conventions: [`../../friction-log/README.md`](../../friction-log/README.md)
- Operational principles: [`../../llms.md`](../../llms.md)

## Design decisions

### The convergence guarantee via escalation discipline

The core guarantee: no friction cluster can stay at the same
intervention level indefinitely. If a skill update doesn't eliminate
recurrence, the next review escalates to a code change. If a code
change is roadmap-blocked, the API becomes a removal candidate. This
escalation discipline is what makes convergence structural rather than
aspirational.

### Intervention taxonomy ordered by permanence

Nine intervention types, ordered tooling > code > feature > skill >
doc > agent-context > discoverability > example > removal. The
ordering reflects permanence: tooling enforces mechanically; documentation
only informs. A finding that could be addressed by tooling should not
be addressed by documentation alone — it would recur.

The "something else altogether" types that go beyond code/doc/skill:

- **`tooling`**: invariant enforcement via doctor checks or lint rules.
  The single-base rule, location-independence, no-cross-package-peers
  are currently only documented. Tooling would catch violations before
  they enter the friction log.
- **`agent-context`**: the knowledge-acquired tables in retros are a
  queue of facts to add to `skmtc agent-context` output. Fixing the
  briefing upstream eliminates the friction at source rather than
  documenting around it after the fact.
- **`removal`**: sometimes deletion is higher-leverage than continued
  documentation. The GraphQL thin-wrapper generators were removed
  rather than fixed. The decision tree includes removal as a legitimate
  option after lower-permanence interventions have failed.

### Friction Recurrence Rate as the primary metric

FRR = recurrent entries / total entries per period. The choice of FRR
as the headline metric reflects the core failure mode: friction that's
been logged before but not fixed. A low FRR means novel friction (new
API surface, new use case). A high FRR means interventions aren't
landing. The trend matters more than the absolute value.

### Clustering is a hypothesis, not a fact

The skill requires the agent to state clustering hypotheses explicitly
("I'm grouping these because I believe they share root cause X") rather
than presenting clusters as objective groupings. This keeps the user
in the loop and surfaces the agent's reasoning so it can be corrected.
Two entries about the same surface topic may have completely different
root causes; false grouping leads to interventions that don't work.

### No category-of-fix tagging at retro time

Inherited from `skmtc-retro`: "Possible fixes" in individual entries
are left open-ended. The review is where intervention classification
happens, using the full decision tree and cross-session context. This
separates observation from prescription and prevents the first obvious
fix from being locked in before the pattern is visible.

### Prior action follow-up as a mandatory step

Every review opens by checking what was recommended last time and
whether it worked. This is what distinguishes a system that converges
from one that just accumulates recommendations. Without this step,
the review becomes another layer of friction documentation rather than
an actuator.

### Specificity requirement for action items

Vague recommendations ("improve documentation of X") don't close the
loop. The skill requires action items to name the exact file and
section, the exact content, a falsifiable success criterion, and a
verification method. This makes each item completable in minutes and
verifiable in the next review cycle.

## Open design questions

### Tagging for cross-file pattern matching

Currently, clustering relies on the reviewing agent reading multiple
files and grouping by semantic similarity. A lightweight tag system
(e.g., `[import-api]`, `[enrichment]`, `[naming]`) on entries would
make grep-based clustering possible and more reliable. Cost: adds
per-entry maintenance during retro authoring. Worth considering after
15+ friction files accumulate.

### Integration with agent-context command

The skill recommends `agent-context` as an intervention type but
doesn't currently guide *how* to add to it — what the command reads,
what format its output takes, where that content lives. A follow-up
review of `skmtc agent-context` source would complete this loop.

### Automated recurrence detection

Currently recurrence is detected manually by the reviewing agent
reading prior files. A grep-based check for key phrases or entry
headings across all files would be faster and more reliable. Could be
a doctor subcommand: `skmtc doctor friction-recurrence`.

### Review file accumulation

Over time, the `reviews/` directory will grow. Each review's metrics
history table is the running record — cross-review trends require
reading multiple review files. A single `metrics.md` that aggregates
all reviews' metric rows would make the trend view available without
loading every review file. Defer until 5+ review files exist.

### Wins balance monitoring

The retro skill now requires a high bar for `[win]` entries
(codification candidates only). If the log becomes dominated entirely
by friction, the signal that "this approach works and should be
prescribed" disappears. The review should monitor: are wins appearing
at all? If not, the bar may be too high, or everything worth codifying
has been codified.

## Cross-references

- Skill: [`SKILL.md`](SKILL.md)
- Slash command: [`commands/skmtc-retro-review.md`](commands/skmtc-retro-review.md)
- Feeds from: [`skmtc-retro skill`](../skmtc-retro/SKILL.md)
- Friction log: [`../../friction-log/README.md`](../../friction-log/README.md)
- Review output: [`../../friction-log/reviews/`](../../friction-log/reviews/)
- LLM doc: [`../../llms.md`](../../llms.md)
