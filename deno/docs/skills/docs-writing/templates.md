# Page templates

Compressed skeletons per page type: ordered sections, a one-line note per
section, and the quality criteria that separate a good instance from a mediocre
one. Companion to `SKILL.md` §9 — start from the skeleton, delete sections that
genuinely don't apply, keep the order ("conform to type", SKILL.md §6).

Distilled July 2026 from The Good Docs Project templates
(https://thegooddocsproject.dev/template/, source repo
https://gitlab.com/tgdp/templates), Keep a Changelog 1.1.0
(https://keepachangelog.com/en/1.1.0/), Art of README
(https://github.com/hackergrrl/art-of-readme), and standard-readme
(https://github.com/RichardLitt/standard-readme).

## How-to guide

```
# {Verb} {object}                — bare-infinitive task title ("Connect to the VM
                                   instance"), not an "-ing" form or a feature noun
Overview                         — 1–2 sentences: "This guide shows you how to {task}."
                                   Optionally when/why you'd do it
Before you start (optional)      — bulleted prerequisites: access, tools, prior setup
## {Task name}                   — numbered steps, each starting with an action verb
   Step                          — instruction + optional context/code + expected result
   Substeps                      — only when a step genuinely decomposes
## {Sub-task} (optional)         — only for big tasks; same step structure
See also                         — related how-tos, concepts, troubleshooting
```

Quality bar:

- **One task per page**, documenting the single safest/most common method —
  never two ways to do the same thing. Max ~8–10 steps before splitting into
  sub-tasks.
- **No concept explanations in the body**; conditional imperatives ("If you want
  X, do Y") carry the branching; link out at the bottom, not inline everywhere.
- **Tested end-to-end** against the current release, in order.

## Tutorial

```
# {Tutorial title}
Overview                         — what you'll build, audience, and verb-led learning
                                   objectives: "By the end, you'll be able to {verb}…"
Background (optional)            — product context / why this matters
Before you start                 — ALL prerequisites: knowledge, software, environment
## {Stage} (repeat per stage)    — brief context, then numbered imperative steps
   Each step                     — instruction + code + expected result (checkpoint)
Summary                          — the skills actually gained
Next steps                       — follow-on tutorials, tasks, or docs
```

Quality bar:

- **Guaranteed success**: a managed start-to-end path that eliminates the
  unexpected; assume no practical knowledge; state every tool and config.
- **Checkpoints everywhere**: every step shows its expected result so the
  learner self-verifies.
- **Learning-oriented**: objectives written first and used to scope the content;
  the summary proves they were met.

## Reference entry

```
# {Reference title}
{Scope statement}                — 1–2 sentences: what this lists, how it relates to
                                   other docs
## {Entry group}                 — table or structured list; SAME format and order for
                                   every entry, mirroring the source of truth
   Field table                   — Field | Description | Example
   Command table                 — Command | Description | Argument(s) | Example
   Per parameter                 — required vs optional explicit; concrete example value;
                                   constraints and defaults stated
## Commands (optional)           — code blocks where a table is too cramped
```

Quality bar:

- **Ruthless consistency**: identical columns, phrasing pattern, and ordering —
  the reader predicts where information lives before looking.
- **Every entry has an example** and an explicit required/optional designation;
  descriptions state constraints and defaults, never just restate the name.
- **Entry order mirrors the code/API documented**, so drift is visible.

## Concept / explanation

```
# {Concept name}                 — tolerates an implicit "About …" prefix
Intro (no heading)               — the concept, why it matters, what this page covers
Definition                       — "{X} is …" / "{X} solves …"; diagram with caption
Background (optional)            — origin, design rationale, alternatives rejected
Use cases                        — what the reader can do once they understand this
Comparison (optional)            — table vs. alternatives/related options
Related resources (optional)     — links grouped by kind
```

Quality bar:

- **Zero procedural steps** — numbered instructions mean the content belongs in
  a how-to; link instead.
- **Anchored in the reader's problem**: use cases and comparisons say _when_ to
  reach for this, not just what it is.
- **One concept per page**, with a definition a newcomer could quote.

## README

```
# {Project name}                 — matches the repo/package name; badges few + meaningful
One-liner                        — <120 chars answering "what is this?"; screenshot/demo
                                   if visual
Who this is for                  — target user + objective; caveats/limitations UP FRONT
Table of contents                — only if the README exceeds ~100 lines
Install                          — copy-pasteable block; prerequisites first
Usage                            — the smallest real, runnable example in action
API (optional)                   — signatures, or a link to the full reference
Troubleshooting / FAQ (optional) — issue → solution for the top failure modes
Contributing                     — where to ask, PR expectations
Additional docs / help           — links to the docs tree and support channels
License                          — SPDX name + owner; ALWAYS the final section
```

Principles:

1. **Cognitive funnel**: broadest → most specific, so the reader can bail out at
   any depth having lost minimal time. The widest end answers "is this what I
   need?" before anything else.
2. **The README is a filter, not a manual**: say what it is, show it in action,
   show how to use it. Depth lives in the docs tree.
3. **Usage before API/installation detail** — a runnable example communicates
   fit faster than prose.
4. **As short as possible without being shorter**; never rely on images for
   critical information.
5. Docs are complete "when someone can use your module without ever having to
   look at its code" (standard-readme).

## Changelog (Keep a Changelog)

```
# Changelog
## [Unreleased]                  — accumulate upcoming changes; at release, retitle
## [X.Y.Z] - YYYY-MM-DD          — SemVer + ISO 8601; newest first; version links to diff
### Added                        — new features
### Changed                      — changes in existing functionality
### Deprecated                   — soon-to-be-removed (announce BEFORE removing)
### Removed                      — now-removed features
### Fixed                        — bug fixes
### Security                     — vulnerability fixes, called out explicitly
## [X.Y.W] - YYYY-MM-DD [YANKED] — pulled releases stay listed, tagged
```

Principles: changelogs are **for humans, not machines**; every version gets an
entry; group by change type; latest first; ISO dates; say whether you follow
SemVer. Entries start with a verb and describe the user-visible effect.

Anti-patterns:

- **Commit-log dumps** — commits document code evolution; a changelog
  communicates noteworthy differences to users.
- **Ignoring deprecations** — users must be able to upgrade to a version listing
  the deprecation, migrate, then upgrade past the removal.
- **Regional dates** — anything but YYYY-MM-DD is ambiguous.
- **Selective entries** — partial coverage "can be as dangerous as not having a
  changelog"; it destroys trust in all of it.

## Release notes (audience-facing, per release)

```
# Release notes — {Product} {version}
{Release date}                   — + optional 1–3 sentence summary
## New features                  — **Name** + what it enables + the user benefit
## Features requiring action     — anything needing config/migration to activate
## Improvements                  — quantified where possible
## API updates                   — endpoint and behavior changes for integrators
## Bug fixes                     — "Fixed issue where {problem}…"
### Known issues                 — acknowledged problems + fix status
## Deprecation notices           — feature + end-of-support date + migration path
```

Difference from a changelog: **benefit-first prose, not diffs** ("you can
now…"); action items separated so users can scan for "what do I have to do?";
deprecations always pair a sunset date with a named migration path.

## Troubleshooting guide

```
# Troubleshooting {product/feature}
Scope statement                  — what this guide covers
## {Symptom}                     — heading = what the user SEES: exact error text or
                                   the observable misbehavior (repeat per symptom)
### Cause                        — one cause at a time; multiple causes → multiple blocks
### Solution / workaround        — steps for THIS cause, ending with what success
                                   looks like
### For more information         — related articles, runbooks
```

Quality bar:

- **Symptom-first organization** — what the user experiences and would search
  for, never cause-first or architecture-first.
- **Strict symptom → cause → resolution triples**; every resolution states the
  expected post-fix behavior.
- **Error text quoted exactly** so Ctrl-F and search engines hit.
