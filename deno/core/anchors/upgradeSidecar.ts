/**
 * @fileoverview Host-side sidecar upgrade — the "host-side post-pass"
 * extension the attribution docs reserved. The worker builds sidecars
 * with `parser: undefined` (native parsers don't bundle into the
 * Worker), so landmark names degrade to Definition identifiers and
 * every AST path is empty — spans can't be re-anchored after a
 * formatter reshapes the file. This pass re-resolves each anchor's
 * landmark + child-index path against the raw render text with a real
 * {@link ParserAdapter}, on the host, before sidecars are written.
 *
 * Pure function over its inputs — no I/O; the CLI wires it between
 * the worker result and `writeSidecars`.
 *
 * Guard-rail stance (same as the consumer-formatter runner): an
 * upgrade must never make a sidecar worse. Any condition that
 * prevents a faithful upgrade — parse failure, empty anchor table,
 * non-ASCII source (see below) — returns the sidecar unchanged, and
 * per-anchor resolution failures keep that anchor's worker-side
 * landmark with an empty path.
 */

import type { ParserAdapter } from "./ParserAdapter.ts";
import type { AnchorRow, Sidecar } from "./sidecar.ts";

export type UpgradeSidecarArgs = {
  sidecar: Sidecar;
  /** The artifact text the sidecar's spans index into — the RAW
   *  engine render, before any consumer formatter runs. */
  source: string;
  parser: ParserAdapter;
};

/**
 * Sink spans include the inter-statement whitespace the renderer
 * emitted (a trailing newline pushes `to` past the statement node's
 * end), so an untrimmed whole-Definition span resolves to `Program`
 * and loses its landmark. Trim to the non-whitespace extent before
 * AST resolution. (Spike finding #3 — see `spike-reanchor.ts`.)
 */
const trimSpan = (
  text: string,
  from: number,
  to: number,
): { from: number; to: number } => {
  const slice = text.slice(from, to);
  const leading = slice.length - slice.trimStart().length;
  const trailing = slice.length - slice.trimEnd().length;
  return { from: from + leading, to: to - trailing };
};

/** Sink spans are UTF-16 code units; oxc offsets are UTF-8 bytes.
 *  They coincide only for ASCII text, so a non-ASCII render can't be
 *  upgraded faithfully without a unit conversion (not yet built). */
const isAscii = (text: string): boolean => /^[\x00-\x7F]*$/.test(text);

/**
 * Re-resolve every anchor's landmark + AST path against `source` and
 * return a sidecar whose `L`/`P` pools carry re-anchorable values and
 * whose `parser` field records the adapter that resolved them.
 */
export const upgradeSidecar = (
  { sidecar, source, parser }: UpgradeSidecarArgs,
): Sidecar => {
  if (sidecar.A.length === 0) return sidecar;
  if (!isAscii(source)) return sidecar;

  let parsed: unknown;
  try {
    parsed = parser.parse(sidecar.f, source);
  } catch {
    return sidecar;
  }
  const landmarks = parser.collectLandmarks(parsed);

  const L: string[] = [];
  const P: string[] = [];
  const internedL = new Map<string, number>();
  const internedP = new Map<string, number>();
  const intern = (
    pool: string[],
    cache: Map<string, number>,
    value: string,
  ): number => {
    const hit = cache.get(value);
    if (hit !== undefined) return hit;
    const index = pool.length;
    pool.push(value);
    cache.set(value, index);
    return index;
  };

  const A = sidecar.A.map((row): AnchorRow => {
    const [oldLi, , gi, si, vi, from, to] = row;
    const trimmed = trimSpan(source, from, to);
    const node = parser.smallestEnclosing(parsed, trimmed.from, trimmed.to);
    const location = parser.ascendToLandmark(node, landmarks);
    if (location.landmark === "") {
      // Nothing stable to descend from — keep the worker's landmark
      // (the enclosing Definition's name) so hover/pin flows still
      // group correctly; the empty path marks it non-re-anchorable.
      const workerLandmark = sidecar.L[oldLi] ?? "";
      return [
        intern(L, internedL, workerLandmark),
        intern(P, internedP, ""),
        gi,
        si,
        vi,
        from,
        to,
      ];
    }
    return [
      intern(L, internedL, location.landmark),
      intern(P, internedP, location.path.join(".")),
      gi,
      si,
      vi,
      from,
      to,
    ];
  });

  return { ...sidecar, parser: parser.id, L, P, A };
};
