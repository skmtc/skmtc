/**
 * @fileoverview Phase 1 acceptance check: sidecars written by the CLI's
 * host-side upgrade (`upgradeSidecar` + oxc) carry landmarks + paths that
 * re-anchor onto the FORMATTED on-disk file via the adapter's own
 * `descendPath`/`spanOf` — the exact consumption the Phase 2 vite reader
 * will perform. Companion to `spike-reanchor.ts` (which validated the
 * approach before the emission side existed).
 *
 * Usage:
 *   deno run -A spike-descend.ts <mapsDir> <rawRoot> <formattedRoot>
 */

import { walk } from "@std/fs/walk";
import { join } from "@std/path";
import * as v from "valibot";
import { oxcAdapter } from "./oxcAdapter.ts";
import { sidecarSchema } from "./sidecar.ts";

const normalize = (text: string): string =>
  text
    .replace(/\s+/g, "")
    .replaceAll('"', "'")
    .replaceAll(";", "")
    .replaceAll(",", "")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .replaceAll("|", "");

const trim = (
  text: string,
  from: number,
  to: number,
): { from: number; to: number } => {
  const slice = text.slice(from, to);
  const leading = slice.length - slice.trimStart().length;
  const trailing = slice.length - slice.trimEnd().length;
  return { from: from + leading, to: to - trailing };
};

const [mapsDir, rawRoot, formattedRoot] = Deno.args;
const tally = {
  files: 0,
  anchors: 0,
  emptyPathLandmarkOnly: 0,
  landmarkMissing: 0,
  pathBroken: 0,
  matched: 0,
  mismatched: 0,
};

for await (
  const entry of walk(mapsDir, { includeDirs: false, exts: [".json"] })
) {
  if (!entry.path.endsWith(".skm.json")) continue;
  const sidecar = v.parse(
    sidecarSchema,
    JSON.parse(await Deno.readTextFile(entry.path)),
  );
  const relative = sidecar.f.startsWith("@/") ? sidecar.f.slice(2) : sidecar.f;
  let rawText: string;
  let formattedText: string;
  try {
    rawText = await Deno.readTextFile(join(rawRoot, relative));
    formattedText = await Deno.readTextFile(join(formattedRoot, relative));
  } catch {
    continue;
  }
  tally.files += 1;
  const parsed = oxcAdapter.parse(relative, formattedText);
  const landmarks = oxcAdapter.collectLandmarks(parsed);

  for (const [li, pi, , , , from, to] of sidecar.A) {
    tally.anchors += 1;
    const landmarkName = sidecar.L[li] ?? "";
    const pathText = sidecar.P[pi] ?? "";
    const landmark = landmarks.get(landmarkName);
    if (landmark === undefined) {
      tally.landmarkMissing += 1;
      continue;
    }
    if (pathText === "") {
      // Landmark-only anchor (unresolvable span or the landmark itself).
      tally.emptyPathLandmarkOnly += 1;
    }
    const path = pathText === "" ? [] : pathText.split(".").map(Number);
    const node = oxcAdapter.descendPath(landmark, path);
    if (node === undefined) {
      tally.pathBroken += 1;
      continue;
    }
    const span = oxcAdapter.spanOf(node);
    const trimmed = trim(rawText, from, to);
    const rawSlice = rawText.slice(trimmed.from, trimmed.to);
    const formattedSlice = formattedText.slice(span.start, span.end);
    // The formatted node may be the raw span's smallest ENCLOSING node,
    // so compare containment after normalization.
    if (normalize(formattedSlice).includes(normalize(rawSlice))) {
      tally.matched += 1;
    } else {
      tally.mismatched += 1;
      if (tally.mismatched <= 5) {
        console.error(`mismatch ${relative} @ ${landmarkName}[${pathText}]`);
        console.error(`  raw: ${rawSlice.slice(0, 90).replaceAll("\n", " ")}`);
        console.error(
          `  fmt: ${formattedSlice.slice(0, 90).replaceAll("\n", " ")}`,
        );
      }
    }
  }
}

const rate = tally.anchors === 0
  ? "n/a"
  : `${((tally.matched / tally.anchors) * 100).toFixed(2)}%`;
console.log(JSON.stringify({ ...tally, matchedRate: rate }, null, 2));
