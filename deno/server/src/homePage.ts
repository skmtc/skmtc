// The stack server's home page — HTML for browsers, markdown for curl and
// agents. Served by `createServer` at `/` (content-negotiated on `Accept`),
// `/index.md` and `/llms.txt`, so any deployment of the Hono app — local
// `skmtc serve`, a standalone deploy, or a hosted stack app — describes
// itself without a separate catalog round-trip.
//
// Information architecture: `/` carries orientation and the first successful
// command only; everything deeper lives one level down at a canonical URL
// (`/llms.txt` → `/openapi.json` → the hub page). The HTML layers with
// <details> disclosure; the markdown variant is flat and complete because
// agents want the whole contract inline.

/** Deploy-time identity shown on the home page. All fields optional — a
 *  server created without one still serves a useful, generic page. */
export type StackIdentity = {
  /** `{account}/{slug}` label, e.g. `skmtc/markdown-docs`. */
  name?: string;
  /** Published semver. */
  version?: string;
  /** One-line description of what the stack produces. */
  description?: string;
  /** The stack's hub page. */
  homepageUrl?: string;
};

/** Per-request context the page is rendered from. */
export type HomePageContext = {
  identity: StackIdentity;
  /** Generator ids composed into this server. */
  generators: string[];
  /** The serving origin, from the request URL. */
  origin: string;
  /** Resolved `@skmtc/core` version. */
  coreVersion: string;
};

const FALLBACK_NAME = "skmtc stack server";
const FALLBACK_DESCRIPTION = "Convert an OpenAPI v3 schema into source files.";
const FALLBACK_HOMEPAGE = "https://skmtc.dev";

/** Resolved `@skmtc/core` version — the same skew canary trick the hosted
 *  wrapper uses. Resolution shapes seen live:
 *  `https://jsr.io/@skmtc/core/0.26.0/mod.ts` and `jsr:@skmtc/core@0.26.0`. */
export const resolveCoreVersion = (): string => {
  try {
    const resolved = import.meta.resolve("@skmtc/core");
    const match = /@skmtc\/core[@/]([^/]+)/.exec(resolved);
    return match ? match[1] : resolved;
  } catch {
    return "unresolved";
  }
};

const curlExample = (origin: string): string =>
  `curl -s -X POST ${origin}/artifacts \\
  -H 'content-type: application/json' \\
  -d "{\\"protocol\\":\\"oas\\",\\"schema\\":$(jq -Rs . < openapi.json)}"`;

const installCommand = ({ name }: StackIdentity): string =>
  name
    ? `skmtc init && skmtc install @${name}`
    : "skmtc init && skmtc install @<account>/<stack>";

const agentPrompt = ({ identity, origin }: HomePageContext): string =>
  `Generate code using the SKMTC stack server at ${origin}${
    identity.name ? ` (${identity.name})` : ""
  }.
${identity.description || FALLBACK_DESCRIPTION}
It is deterministic: the same schema always produces the same output.

1. POST ${origin}/artifacts with JSON body:
   {"protocol": "oas", "schema": "<OpenAPI v3 document, JSON-stringified>"}
   (use "gql" with an SDL string for GraphQL)
2. Response: {"artifacts": {"<path>": "<content>", ...}, "manifest": {...}}.
   Write every artifacts entry to disk at its path.
3. The server fails open: bad schemas return 200 with issues in
   manifest.parseIssues. Treat level "error" entries as failures; do not
   retry - fix the schema instead.
4. GET ${origin}/llms.txt describes this server; GET ${origin}/openapi.json
   is its full API contract.`;

const ENDPOINT_LINES: ReadonlyArray<[string, string]> = [
  ["POST /artifacts", "generate all files from a schema"],
  ["POST /subjects", "preview which operations/models would generate"],
  ["POST /descriptors", "enrichment configuration schema"],
  ["POST /validate", "check an enrichment config"],
  ["POST /enrichment-defaults", "schema-derived enrichment defaults"],
  ["POST /to-v3-json", "normalize Swagger 2 / OAS 3.1 to OAS 3.0"],
  ["GET /generators", "generator ids in this stack"],
  ["GET /openapi.json", "this server's own API contract"],
];

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The flat, complete markdown page — served at `/` (non-browser Accept),
 *  `/index.md` and `/llms.txt`. */
export const homePageMd = (context: HomePageContext): string => {
  const { identity, generators, origin, coreVersion } = context;
  const name = identity.name ?? FALLBACK_NAME;
  const homepage = identity.homepageUrl ?? FALLBACK_HOMEPAGE;
  const endpoints = ENDPOINT_LINES.map(([route, what]) =>
    `- \`${route}\` — ${what}`
  ).join("\n");
  const generatorList = generators.length > 0
    ? generators.map((id) => `- ${id}`).join("\n")
    : "- (none configured)";
  return `# ${name}${identity.version ? ` v${identity.version}` : ""}

${identity.description || FALLBACK_DESCRIPTION}

A deployed SKMTC stack server: POST a schema, receive generated source files.
Deterministic — same schema in, same bytes out. Nothing is stored.

## Use

\`\`\`sh
${curlExample(origin)}
\`\`\`

Returns \`{"artifacts": {"<path>": "<content>", ...}, "manifest": {...}}\` —
write each artifacts entry to its path.

Bad schemas do not error: the response is 200 with issues in
\`manifest.parseIssues\`. Treat \`level: "error"\` entries as failures; do not
retry — runs are deterministic, so fix the schema instead.

## When to use it

- You have a schema and want its derived code without writing it
- CI: regenerate on every schema change, diff like source
- Agents: delegate bulk file generation to a single HTTP call

## Customize

The output is a template you own, not a black box. Install the stack locally
and edit the generator source — file paths, templates and structure are the
customization surface.

\`\`\`sh
${installCommand(identity)}
\`\`\`

More at ${homepage}

## Generators

${generatorList}

## Endpoints

${endpoints}

## Prompt for your agent

\`\`\`
${agentPrompt(context)}
\`\`\`

---
core ${coreVersion} · ${homepage}
`;
};

/** The layered HTML page — served at `/` to browsers (`Accept: text/html`). */
export const homePageHtml = (context: HomePageContext): string => {
  const { identity, generators, origin, coreVersion } = context;
  const name = escapeHtml(identity.name ?? FALLBACK_NAME);
  const homepage = escapeHtml(identity.homepageUrl ?? FALLBACK_HOMEPAGE);
  const tagline = escapeHtml(identity.description || FALLBACK_DESCRIPTION);
  const endpointRows = ENDPOINT_LINES.map(
    ([route, what]) =>
      `<tr><td><code>${escapeHtml(route)}</code></td><td>${
        escapeHtml(what)
      }</td></tr>`,
  ).join("\n        ");
  const generatorItems = generators.length > 0
    ? generators.map((id) => `<li>${escapeHtml(id)}</li>`).join("\n        ")
    : "<li>(none configured)</li>";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — stack server</title>
<style>
  :root {
    --bg: #0c0e0b; --surface: #12150f; --border: #262b21;
    --text: #ccd4c4; --dim: #79826f; --accent: #9fd077; --amber: #d8a657;
    color-scheme: dark;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f7f5ef; --surface: #efece3; --border: #d9d5c6;
      --text: #2c3128; --dim: #6f7566; --accent: #46732f; --amber: #96650f;
      color-scheme: light;
    }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg); color: var(--text);
    font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
    font-size: 13.5px; line-height: 1.55; padding: 1.5rem 1.1rem 2.5rem;
  }
  main { max-width: 41rem; margin: 0 auto; display: flex; flex-direction: column; gap: 1.4rem; }
  a { color: var(--accent); text-decoration: none; }
  a:hover, a:focus-visible { text-decoration: underline; }
  a:focus-visible, button:focus-visible, summary:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }
  header { display: flex; flex-direction: column; gap: 0.3rem; }
  .name { font-size: 17px; font-weight: 700; }
  .name .ver { color: var(--dim); font-weight: 400; font-size: 13.5px; margin-left: 0.5em; }
  nav { color: var(--dim); margin-top: 0.2rem; }
  nav a { margin-right: 0.9em; }
  h2 { font-size: 13.5px; font-weight: 700; color: var(--accent); margin-bottom: 0.45rem; }
  h2::before { content: "## "; color: var(--dim); font-weight: 400; }
  .dim { color: var(--dim); }
  p { margin-bottom: 0.4rem; }
  p:last-child { margin-bottom: 0; }
  ul { list-style: none; display: flex; flex-direction: column; gap: 0.25rem; }
  li { padding-left: 1.1em; text-indent: -1.1em; }
  li::before { content: "- "; color: var(--dim); }
  .block { position: relative; background: var(--surface); border: 1px solid var(--border);
           border-radius: 4px; padding: 0.75rem 0.9rem; margin: 0.55rem 0 0.45rem;
           transition: border-color 0.15s; }
  .block.flash { border-color: var(--accent); }
  .block pre { overflow-x: auto; }
  .block code { white-space: pre; }
  .p { color: var(--amber); user-select: none; }
  .copy { position: absolute; top: 0.45rem; right: 0.55rem; background: none; border: none;
          cursor: pointer; padding: 0.1rem 0.35rem; border-radius: 3px; font: inherit;
          font-size: 12px; color: var(--dim); transition: color 0.15s, background 0.15s; }
  .copy:hover { color: var(--accent); }
  .copy.done { color: var(--bg); background: var(--accent); }
  details { border-top: 1px solid var(--border); padding: 0.55rem 0; }
  details:last-of-type { border-bottom: 1px solid var(--border); }
  summary { cursor: pointer; list-style: none; color: var(--text); display: flex;
            align-items: baseline; gap: 0.5em; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: "+"; color: var(--accent); width: 1em; }
  details[open] summary::before { content: "-"; }
  summary .copy { position: static; margin-left: auto; }
  summary .hint { margin-left: auto; }
  details > :not(summary) { margin-top: 0.5rem; margin-left: 1.5em; }
  table { border-collapse: collapse; }
  td { padding: 0.1rem 0; vertical-align: baseline; }
  td:first-child { padding-right: 1.2em; white-space: nowrap; }
  td:last-child { color: var(--dim); }
  .tablewrap { overflow-x: auto; }
  footer { color: var(--dim); font-size: 12.5px; display: flex; flex-wrap: wrap;
           column-gap: 0.9em; row-gap: 0.2em; }
  footer a { color: var(--dim); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<main>
  <header>
    <div class="name">${name}${
    identity.version
      ? `<span class="ver">v${escapeHtml(identity.version)}</span>`
      : ""
  }</div>
    <div>${tagline}</div>
    <div class="dim">Deterministic — same schema in, same bytes out. Nothing is stored.</div>
    <nav aria-label="formats">
      <a href="/index.md">.md</a>
      <a href="/openapi.json">openapi.json</a>
      <a href="${homepage}">hub &#8599;</a>
    </nav>
  </header>

  <section>
    <h2>use</h2>
    <div class="block">
      <button class="copy" data-copy="curl-cmd">[copy]</button>
      <pre><code id="curl-cmd"><span class="p">$</span> ${
    escapeHtml(curlExample(origin))
  }</code></pre>
    </div>
    <p>Returns <code>{"artifacts": {"&lt;path&gt;": "&lt;content&gt;", …},
    "manifest": {…}}</code> — write each entry to its path.</p>
    <p class="dim">Bad schemas don't error; they log. Check
    <code>manifest.parseIssues</code> before trusting partial output.</p>
  </section>

  <div>
    <details>
      <summary>when to use it</summary>
      <ul>
        <li>You have a schema and want its derived code without writing it</li>
        <li>CI: regenerate on every schema change, diff like source</li>
        <li>Agents: delegate bulk file generation to a single HTTP call</li>
      </ul>
    </details>
    <details>
      <summary>customize</summary>
      <p>The output is a template you own, not a black box. Install the stack
      locally and edit the generator source — file paths, templates and
      structure are the customization surface.</p>
      <div class="block">
        <button class="copy" data-copy="install-cmd">[copy]</button>
        <pre><code id="install-cmd"><span class="p">$</span> ${
    escapeHtml(installCommand(identity))
  }</code></pre>
      </div>
      <p class="dim">Docs and versions: <a href="${homepage}">hub &#8599;</a></p>
    </details>
    <details>
      <summary>prompt for your agent
        <button class="copy" data-copy="agent-prompt">[copy]</button>
      </summary>
      <div class="block">
        <pre><code id="agent-prompt">${
    escapeHtml(agentPrompt(context))
  }</code></pre>
      </div>
    </details>
    <details>
      <summary>generators<span class="hint dim">${generators.length}</span></summary>
      <ul>
        ${generatorItems}
      </ul>
    </details>
    <details>
      <summary>endpoints</summary>
      <div class="tablewrap"><table>
        ${endpointRows}
      </table></div>
    </details>
  </div>

  <footer>
    <span>core ${escapeHtml(coreVersion)}</span>
    <a href="/llms.txt">/llms.txt</a>
    <a href="${homepage}">hub &#8599;</a>
  </footer>
</main>
<script>
  document.querySelectorAll(".copy").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const el = document.getElementById(btn.dataset.copy);
      await navigator.clipboard.writeText(el.innerText.replace(/^\\$ /, ""));
      btn.textContent = "[copied \\u2713]";
      btn.classList.add("done");
      const block = el.closest(".block");
      if (block) block.classList.add("flash");
      setTimeout(() => {
        btn.textContent = "[copy]";
        btn.classList.remove("done");
        if (block) block.classList.remove("flash");
      }, 1600);
    });
  });
</script>
</body>
</html>
`;
};
