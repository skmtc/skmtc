---
id: rewrite-flawed-page
fixture: rewrite-flawed-page
docs:
  - deno/docs/skills/docs-writing/SKILL.md
  - deno/docs/skills/docs-writing/templates.md
maxTurns: 30
graders:
  - kind: file-exists
    path: guides/export-data.md
  - kind: file-contains
    path: guides/export-data.md
    pattern: "--overwrite"
  - kind: run-command
    cmd: deno
    args: ["run", "--allow-read", "--allow-write", "tool/export.ts", "--help"]
  - kind: llm-judge
    rubric: >
      Pass only if the rewritten guides/export-data.md (a) documents
      the real --overwrite flag and no longer presents --force as an
      existing option, (b) states the tool's real defaults — output
      directory dist/ and format json — matching tool/export.ts,
      (c) opens by stating the task the page accomplishes (with any
      prerequisites) instead of project history, with the design
      rationale digression removed or moved out of the how-to,
      (d) contains no filler ("simply", "easily", "just",
      "obviously"), no "please" in instructions, no time-bound
      qualifiers ("currently", "new", "will" for tool behavior), and
      no "click here"-style link text, (e) presents steps as numbered
      single-action imperatives that state the expected result (such
      as which file appears), and (f) uses one consistent term for
      the exported output instead of alternating between "export
      file", "output bundle", and "artifact". Fail if the page
      invents any flag or default not present in tool/export.ts, even
      if the prose is otherwise clean.
---

This workspace contains a small Deno CLI at tool/export.ts that exports table
data, and a how-to page at guides/export-data.md that documents it.

The page has quality problems, and some of what it says the tool does is wrong.
Rewrite guides/export-data.md in place so it accurately serves a developer who
wants to export their data with this tool. Keep it a how-to page. Do not modify
tool/export.ts — the source is the ground truth for what the tool actually does.
