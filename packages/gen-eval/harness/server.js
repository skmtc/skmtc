#!/usr/bin/env node
/**
 * gen-eval harness dashboard — a tiny persistent local server.
 *
 *   node harness/server.js          # http://127.0.0.1:8484
 *   GEN_EVAL_PORT=9000 node ...     # custom port
 *
 * Routes:
 *   /            run list (live runs badged, auto-refreshing)
 *   /runs/<id>/… static serve of a run dir — including viewer.html,
 *                whose live mode polls transcript.jsonl through this
 *                same server
 *   /api/runs    run list as JSON
 *   /health      liveness probe (run.sh uses it to start-if-needed)
 *
 * Binds 127.0.0.1 only. No dependencies, no build step.
 */
import { createServer } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const HARNESS = dirname(fileURLToPath(import.meta.url))
const RUNS_DIR = join(HARNESS, 'runs')
const PORT = Number(process.env.GEN_EVAL_PORT || 8484)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.kt': 'text/plain; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8'
}

const readJson = async path => {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

const listRuns = async () => {
  let entries = []
  try {
    entries = await readdir(RUNS_DIR)
  } catch {
    return []
  }
  const runs = []
  for (const name of entries.sort().reverse()) {
    const dir = join(RUNS_DIR, name)
    try {
      if (!(await stat(dir)).isDirectory()) continue
    } catch {
      continue
    }
    const meta = (await readJson(join(dir, 'meta.json'))) ?? {}
    const structural = await readJson(join(dir, 'structural.json'))
    const aggregate = Array.isArray(structural) && structural[0] ? structural[0].aggregate : null

    let finished = Boolean(meta.result && meta.result.turns != null)
    let transcriptAge = null
    if (!finished) {
      try {
        const transcriptPath = join(dir, 'transcript.jsonl')
        const info = await stat(transcriptPath)
        transcriptAge = (Date.now() - info.mtimeMs) / 1000
        const transcript = await readFile(transcriptPath, 'utf8')
        finished = transcript.includes('"type":"result"') || transcript.includes('"type": "result"')
      } catch {
        finished = false
      }
    }
    // no result event + transcript quiet for 5 min -> aborted, not live
    const status = finished ? 'done' : transcriptAge != null && transcriptAge < 300 ? 'live' : 'aborted'

    let gates = null
    try {
      const report = await readFile(join(dir, 'report.md'), 'utf8')
      const match = report.match(/Gates passed: (\d+), failed: (\d+)/)
      if (match) gates = { passed: Number(match[1]), failed: Number(match[2]) }
    } catch {
      /* no report yet */
    }

    runs.push({
      id: name,
      model: meta.model ?? null,
      label: meta.label || null,
      skillSha: meta.skillSha ? String(meta.skillSha).slice(0, 10) : null,
      started: meta.started ?? null,
      live: status === 'live',
      status,
      costUsd: meta.result?.costUsd ?? null,
      turns: meta.result?.turns ?? null,
      maxThinkBlock: meta.thinking?.maxThinkBlock ?? null,
      gates,
      verdict: aggregate ? aggregate.verdict : null,
      warnings: aggregate ? aggregate.warningCount : null,
      failedChecks: aggregate ? aggregate.failedChecks : []
    })
  }
  return runs
}

const INDEX_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>gen-eval runs</title>
<style>
  :root { --bg:#101418; --panel:#171c22; --panel2:#1d232b; --border:#2a323c;
    --text:#d7dee6; --dim:#8b98a5; --accent:#4cc38a; --warn:#e5b567; --error:#e5484d;
    --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--text); font-family:var(--sans); font-size:13px; padding:24px; }
  h1 { font-size:20px; font-weight:650; margin-bottom:4px; }
  .sub { color:var(--dim); margin-bottom:20px; }
  table { border-collapse:collapse; width:100%; font-family:var(--mono); }
  th { text-align:left; color:var(--dim); font-family:var(--sans); font-weight:600;
       padding:8px 12px; border-bottom:1px solid var(--border); }
  td { padding:8px 12px; border-bottom:1px solid var(--border); white-space:nowrap; }
  tr:hover td { background:var(--panel); }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  .live { color:var(--error); font-weight:700; }
  .done { color:var(--dim); }
  .verdict-clean { color:var(--accent); }
  .verdict-warn { color:var(--warn); }
  .verdict-fail { color:var(--error); }
  .empty { color:var(--dim); padding:40px 0; font-family:var(--sans); }
</style></head><body>
<h1>gen-eval harness runs</h1>
<p class="sub">auto-refreshes · live runs open in follow mode · <span id="count"></span></p>
<div id="list"></div>
<script>
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function refresh() {
  try {
    const runs = await (await fetch('/api/runs', { cache: 'no-store' })).json();
    document.getElementById('count').textContent = runs.length + ' run(s)';
    if (!runs.length) {
      document.getElementById('list').innerHTML =
        '<p class="empty">No runs yet. Start one: <code>harness/run.sh claude-fable-5</code></p>';
      return;
    }
    let html = '<table><tr><th>run</th><th>status</th><th>model</th><th>verdict</th><th>gates</th>' +
      '<th>turns</th><th>cost</th><th title="largest single think block: tokens / wall seconds">max think</th>' +
      '<th>skill</th><th>open</th></tr>';
    for (const run of runs) {
      const verdictClass = run.verdict ? 'verdict-' + run.verdict : '';
      const verdict = run.verdict
        ? run.verdict + (run.warnings ? '(' + run.warnings + 'w)' : '')
        : '—';
      const think = run.maxThinkBlock
        ? Math.round(run.maxThinkBlock.tokens / 1000) + 'k' +
          (run.maxThinkBlock.seconds != null ? ' / ' + Math.round(run.maxThinkBlock.seconds) + 's' : '')
        : '—';
      html += '<tr>' +
        '<td>' + esc(run.id) + (run.label ? ' <span style="color:var(--warn)">[' + esc(run.label) + ']</span>' : '') + '</td>' +
        '<td>' + (run.status === 'live' ? '<span class="live">&#9679; LIVE</span>'
          : run.status === 'aborted' ? '<span style="color:var(--warn)">aborted</span>'
          : '<span class="done">done</span>') + '</td>' +
        '<td>' + esc(run.model ?? '?') + '</td>' +
        '<td class="' + verdictClass + '">' + esc(verdict) + '</td>' +
        '<td>' + (run.gates ? run.gates.passed + ' ok / ' + run.gates.failed + ' fail' : '—') + '</td>' +
        '<td>' + (run.turns ?? '—') + '</td>' +
        '<td>' + (run.costUsd != null ? '$' + run.costUsd.toFixed(2) : '—') + '</td>' +
        '<td>' + esc(think) + '</td>' +
        '<td>' + esc(run.skillSha ?? '—') + '</td>' +
        '<td><a href="/runs/' + encodeURIComponent(run.id) + '/viewer.html">viewer</a> · ' +
        '<a href="/runs/' + encodeURIComponent(run.id) + '/report.md">report</a> · ' +
        '<a href="/runs/' + encodeURIComponent(run.id) + '/timeline.md">timeline</a></td>' +
        '</tr>';
    }
    document.getElementById('list').innerHTML = html + '</table>';
  } catch (error) {
    document.getElementById('count').textContent = 'refresh failed: ' + error;
  }
}
refresh();
setInterval(refresh, 5000);
</script></body></html>`

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const send = (status, body, type = 'text/plain; charset=utf-8') => {
    response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    response.end(body)
  }

  try {
    if (url.pathname === '/health') return send(200, 'ok')
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return send(200, INDEX_HTML, 'text/html; charset=utf-8')
    }
    if (url.pathname === '/api/runs') {
      return send(200, JSON.stringify(await listRuns()), 'application/json; charset=utf-8')
    }
    if (url.pathname.startsWith('/runs/')) {
      const relative = normalize(decodeURIComponent(url.pathname.slice('/runs/'.length)))
      if (relative.startsWith('..') || relative.includes('../')) return send(403, 'forbidden')
      const filePath = join(RUNS_DIR, relative)
      try {
        const body = await readFile(filePath)
        return send(200, body, MIME[extname(filePath)] ?? 'application/octet-stream')
      } catch {
        return send(404, 'not found: ' + relative)
      }
    }
    return send(404, 'not found')
  } catch (error) {
    return send(500, String(error))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`gen-eval dashboard: http://127.0.0.1:${PORT}/`)
})
