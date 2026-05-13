---
description: Run a SKMTC retrospective on the current session — capture friction and wins to the friction log
argument-hint: "[topic-summary]"
---

Run a SKMTC retrospective on this session.

**If `$ARGUMENTS` is non-empty**, use it as the session-topic hint for
the filename. Normalize it to lowercase kebab-case (e.g.,
`"Shadcn form clone"` → `shadcn-form-clone`). Use as the
`<short-summary>` portion of the filename described in step 2 below.

**If `$ARGUMENTS` is empty**, infer the topic from the session content
yourself — pick the 3-4 word kebab-case description that captures what
made this session distinct from others on the same date.

Then follow the standard retro flow (full details in the `skmtc-retro`
skill's `SKILL.md`):

1. **Locate the friction-log directory.** Walk up from the current
   working directory looking for `skmtc/deno/docs/friction-log/`. If
   you can't find a SKMTC root, ask the user where to log to — do not
   silently default.

2. **Pick a filename for this session** following the convention
   `<YYYY-MM-DD>-<short-summary>.md` using today's date and the topic
   summary from `$ARGUMENTS` (or inferred).

3. **Check for an existing file** with the same name:
   - If it exists, read it and prepare to append at the next
     sequential entry number.
   - If not, prepare to create a new file with the session header
     (see the skill's §4 "File format").

4. **Reflect on the session** using the prompts from the skill's §3.
   Capture both friction (surprises, default overrides, multi-cycle
   struggles, idiomatic gaps) and wins (patterns worth preserving).

5. **Draft entries** in the skill's standard format: severity tag,
   what happened, what was expected, why it matters, possible fixes
   (open-ended — **do not pre-commit to a category of fix**), version
   anchor, status.

6. **Write the file** (create or append). Append-only — do not modify
   earlier entries.

7. **Summarise to the user** in one short line:
   `Logged N entries (X friction, Y wins) to <filename>. Headings: ...`

If the session genuinely produced no new observations beyond what's
already captured in the skills or the existing friction log, **say so
explicitly** rather than inventing entries. False signal is worse than
no signal.

For full conventions, format details, reflection prompts, and worked
examples, defer to the `skmtc-retro` skill's `SKILL.md`.
