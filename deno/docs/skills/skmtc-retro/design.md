# skmtc-retro skill — design document

> Brief design document for the retro skill, written retroactively for
> symmetry with the other skills in this directory.
>
> The loadable skill is [`SKILL.md`](SKILL.md); the slash command is
> [`commands/skmtc-retro.md`](commands/skmtc-retro.md).

## Purpose

Capture observations only the LLM can see — guesses, default
overrides, surprises, idiomatic gaps, and patterns worth preserving —
from a SKMTC session, and write them to a per-session dated file in
the project's friction log so they can be reviewed and acted on later.

Distinct from the other three skills by being **meta-work**:
`skmtc-cli`, `skmtc-generator`, and `skmtc-debug` guide doing
something. `skmtc-retro` guides reflecting *on* what was done.

## Audience

Anyone who's just completed a substantive SKMTC session. Not
role-specific; applies to users, authors, and debuggers alike.

The defining trigger is **end-of-session reflection**, not a kind of
work. The skill is explicitly not for ordinary work flow.

## Triggers

- "retro" / "skmtc retro"
- "log friction"
- "reflect on this session"
- "what did we learn"
- "run a retrospective"
- Slash command: `/skmtc-retro [topic-summary]`

Should not auto-load during ordinary work — only at session
boundaries or on explicit invocation.

## Scope boundary

### In skill

- The reflection prompts (the questions to ask before drafting entries)
- The per-session-file naming convention (`<YYYY-MM-DD>-<short-summary>.md`)
- The entry format (severity tag, what-happened, what-expected,
  why-it-matters, possible-fixes, version anchor, status)
- The "no category-of-fix tag" constraint (per user preference)
- Examples of high-value vs low-value entries
- The "say nothing if there's nothing new" rule

### Deferred

- The friction log conventions doc: [`../../friction-log/README.md`](../../friction-log/README.md)
- The full operational principles (in [`../../llms.md`](../../llms.md))
- Per-skill anti-patterns (in each skill's SKILL.md)

### Boundary with other skills

- **skmtc-cli / skmtc-generator / skmtc-debug**: the doing-skills. The
  retro skill activates only after one of these has produced
  observable session content worth reflecting on.

## Design decisions

A few choices that were made deliberately during the skill's authoring:

### Per-session files, not a single growing log

Files named `<YYYY-MM-DD>-<short-summary>.md`. Reasoning: ISO date
prefix sorts chronologically; per-file numbering is simpler than
global; concurrent sessions don't conflict; topic-distinct sessions
on the same date coexist via the summary portion.

### No category-of-fix tag

Per explicit user direction. Auto-tagging "this is a skill gap" the
moment friction is observed forecloses contemplation about the *best*
fix in favor of the *obvious* fix. Leaving "Possible fixes"
open-ended encourages reflection during periodic review rather than
locking in the first idea.

### Severity tags

Four tiers (`[blocker]`, `[friction]`, `[polish]`, `[win]`) including
positive observations. Wins are equally valuable signal — they
identify patterns to preserve and codify.

### Skip-criteria for trivial sessions

Explicit "skip retros for" rules — quick lookups, single-command
tasks, sessions with no friction. Counters the risk that embedded
retro practice produces noise from every interaction. Substantive
work only.

### False signal is worse than no signal

The skill explicitly empowers the LLM to produce *nothing* if there's
nothing genuinely new to log. Counters the default LLM behavior of
"produce output to fill the request."

### The recursive case

If the skill itself has a gap (a missing reflection prompt, an
unclear instruction, a case the format doesn't handle well), the LLM
logs that as a retro entry. The skill should improve from its own
output.

## Open design questions

### Should the friction-log file location be discovered or hardcoded?

Currently the skill walks up from CWD looking for
`skmtc/deno/docs/friction-log/`. This is portable across machines
but adds discovery cost. Alternative: project-relative path in a
config file. Defer until the discovery cost becomes a problem.

### Mid-session retros

Currently the skill is positioned as end-of-session. Could also be
useful as a mid-session checkpoint ("log this observation before we
keep going"). The skill's wording supports this; explicit invocation
overrides the "substantive work" filter.

### Cross-session pattern surfacing

Multiple session files might contain related observations. A future
mechanism could surface patterns across files (e.g., "three sessions
this month logged the same `as`-casts mistake"). Not in scope for
v0.1.0.

### Wins vs friction balance

If the log skews entirely toward friction over many sessions, the
team's signal is incomplete. The skill prompts for wins explicitly,
but enforcement is soft. Worth monitoring.

## Cross-references

- Skill: [`SKILL.md`](SKILL.md)
- Slash command: [`commands/skmtc-retro.md`](commands/skmtc-retro.md)
- Friction log conventions: [`../../friction-log/README.md`](../../friction-log/README.md)
- LLM doc operational reference: [`../../llms.md`](../../llms.md)
