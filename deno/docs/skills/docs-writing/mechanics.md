# Mechanical enforcement and the machine surface

Companion to `SKILL.md` — the automatable subset of the craft rules, and the
llms.txt format. Read when wiring docs checks into CI or standing up the
machine-readable surface, not at the moment of writing a page.

Distilled July 2026 from https://vale.sh, https://llmstxt.org,
https://github.com/DavidAnson/markdownlint,
https://github.com/lycheeverse/lychee, and GitLab's docs-testing pipeline
(https://docs.gitlab.com/development/documentation/testing/).

## What's automatable vs. not

Automatable (put in CI, stop relitigating in review): filler words,
banned/time-bound terms, terminology consistency, heading hierarchy, code-fence
language tags, missing alt text, broken links, sentence-case headings, example
execution.

Not automatable (the review's actual job): type purity, verified behavior claims
(SKILL.md §1.1), information scent of headings, persona fit, whether the opening
establishes context, alt-text _quality_.

## Vale — prose linting

Vale (https://vale.sh) is a single-binary CLI that lints prose against YAML
rules; it's markdown-aware (skips code blocks by default) and ships ready-made
packages for the major style guides: `Google`, `Microsoft`, `write-good` (weasel
words, passive voice), `proselint`, `alex` (insensitive language).

Minimal realistic `.vale.ini` for a markdown docs tree:

```ini
StylesPath = .vale/styles
MinAlertLevel = warning
Packages = Google

# Project-accepted/rejected terms:
# .vale/styles/config/vocabularies/Docs/{accept.txt,reject.txt}
Vocab = Docs

[*.md]
BasedOnStyles = Vale, Google, Docs
# Tone down an inherited rule without forking the package:
Google.Passive = suggestion
```

Custom house rules go in `.vale/styles/Docs/*.yml`. The rule types that map
directly onto SKILL.md's style rules:

**`existence` — ban filler words** (§4):

```yaml
# .vale/styles/Docs/Filler.yml
extends: existence
message: "Remove filler: '%s' adds no information."
level: error
ignorecase: true
tokens:
  - simply
  - easily
  - just
  - obviously
  - clearly
  - of course
```

A second `existence` rule with `currently|new|soon|as of this
writing|latest`
enforces timeless docs (§4) — scope it to exclude changelog paths via a per-glob
section in `.vale.ini`.

**`consistency` — one term per concept** (§4). `either` lists variant pairs of
which only one may appear per document:

```yaml
# .vale/styles/Docs/TermConsistency.yml
extends: consistency
message: "Inconsistent term: pick one of '%s' per document."
level: error
ignorecase: true
either:
  API key: API token
  sign in: log in
  config file: configuration file
```

**`substitution` — enforce the canonical term**, with editor auto-fix:

```yaml
# .vale/styles/Docs/Terms.yml
extends: substitution
message: "Use '%s' instead of '%s'."
level: warning
ignorecase: true
action:
  name: replace
swap:
  "e-mail": email
  "repo": repository
  "whitelist": allowlist
  "blacklist": blocklist
```

Other rule types available: `occurrence` (e.g. max sentence length),
`repetition`, `conditional`, `capitalization` (e.g. sentence-case headings),
`metric` (readability thresholds), `spelling`, `sequence`, `script`.

## Structural checks — markdownlint + lychee

**markdownlint** (`markdownlint-cli2` in CI) — the rules that carry docs
quality, mapping to SKILL.md §6:

- `MD001` — heading levels increment by one (no H2 → H4)
- `MD040` — fenced code blocks declare a language
- `MD045` — images have alt text
- `MD042` — no empty links

**lychee** — async link checker for markdown. Run internal-link checks on every
PR (`--offline`, or an include/exclude split) and external-link checks on a
weekly schedule — external checks on every PR are flaky (rate limits, transient
5xx). Supports `.lycheeignore` and `--accept 200,429`.

GitLab's docs pipeline pairs exactly these: Vale + markdownlint (+ link
checking) as the standard stack.

## Testing code examples

A fenced code block is a claim; untested claims rot (SKILL.md §1.7, §7).
Patterns by ecosystem:

- **Rust**: doctests built in; `mdbook test` executes blocks in a markdown book.
- **Python**: `pytest --doctest-glob='*.md'`; or **pytest-examples** (Pydantic
  team) — finds Python blocks in markdown, lints, executes, checks printed
  output, and can rewrite blocks in place.
- **OCaml**: MDX, integrated into dune.
- **Generic / this repo**: extract fenced blocks by info-string tag with a small
  script and execute them in CI; at minimum, type-check snippets by
  concatenating them into a scratch module. Mark deliberately non-runnable
  fragments with a distinct tag so the untagged default stays "this must run".

In this tree, `deno/docs/verify-docs.ts` hosts docs-writing's mechanical checks:
the Diátaxis tree-mapping sync and the filler-word guard (checks 4 and 5). A
fenced-block extractor running under `deno check` would cover the TypeScript
examples next.

## llms.txt — the machine-readable docs index

Spec: https://llmstxt.org. A markdown file at the site root giving LLMs a
curated map of the docs — context windows can't hold a whole site, so hand
agents a short index of clean markdown instead of letting them scrape HTML.

Format (order fixed; only the H1 is required):

```markdown
# Project name

> One-paragraph summary: the key facts an agent needs first.

Optional freeform background paragraphs (no headings).

## Section name

- [Page title](https://url): one-line description — what it covers and when to
  read it

## Optional

- [Secondary link](https://url): links here may be skipped when context is short
```

- `llms.txt` is the index; `llms-full.txt` concatenates the entire corpus into
  one file so a single URL loads full context. Ship both if the corpus fits a
  context window; the index alone otherwise.
- Entry descriptions: one line, concrete, front-loaded — "Reference for the runs
  API: endpoints, auth, pagination", not "Learn more about runs".
- Test it: expand the file into an LLM context and ask real product questions
  against it.
- Honest caveat: no major crawler is confirmed to request llms.txt unprompted.
  Its proven value is deliberate use — humans and agents fetching it as context
  — not passive SEO. Adoption is near-standard among dev-tool docs (Anthropic,
  Stripe, Cloudflare, Vercel; Mintlify auto-generates it), so its absence now
  reads as a gap.
- The companion convention: serve a clean `.md` variant of every page (append
  `.md` to the page URL).
