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
    const [
      oldLandmarkIndex,
      ,
      generatorIndex,
      schemaIndex,
      variantIndex,
      from,
      to,
    ] = row;
    const trimmed = trimSpan(source, from, to);
    const node = parser.smallestEnclosing(parsed, trimmed.from, trimmed.to);
    const location = parser.ascendToLandmark(node, landmarks);
    if (location.landmark === "") {
      // Nothing stable to descend from — keep the worker's landmark
      // (the enclosing Definition's name) so hover/pin flows still
      // group correctly; the empty path marks it non-re-anchorable.
      const workerLandmark = sidecar.L[oldLandmarkIndex] ?? "";
      return [
        intern(L, internedL, workerLandmark),
        intern(P, internedP, ""),
        generatorIndex,
        schemaIndex,
        variantIndex,
        from,
        to,
      ];
    }
    return [
      intern(L, internedL, location.landmark),
      intern(P, internedP, location.path.join(".")),
      generatorIndex,
      schemaIndex,
      variantIndex,
      from,
      to,
    ];
  });

  return { ...sidecar, parser: parser.id, L, P, A };
};

export type ReanchorSidecarArgs = {
  /** An upgraded sidecar (real landmarks + AST paths — run
   *  {@link upgradeSidecar} first). */
  sidecar: Sidecar;
  /** The artifact text as it now exists ON DISK — e.g. after the
   *  consumer's formatter ran over the raw render. */
  source: string;
  parser: ParserAdapter;
};

/**
 * Realign a sidecar's byte spans to a reshaped copy of its artifact by
 * resolving each anchor's landmark + AST path against `source` — so the
 * written sidecar describes the file as it actually exists on disk
 * (formatted coordinates), and readers need no runtime re-anchoring.
 *
 * Returns `undefined` when realignment isn't possible at all —
 * non-ASCII source (span-unit skew), parse failure, or no anchor
 * resolving. The caller MUST then keep the raw-coordinate sidecar AND
 * the raw manifest lengths together: updating the manifest without
 * realigned spans would defeat the reader's drift detection and serve
 * wrong spans silently. Individual anchors that fail to resolve are
 * dropped (their parallel `An` entries with them).
 */
export const reanchorSidecar = (
  { sidecar, source, parser }: ReanchorSidecarArgs,
): Sidecar | undefined => {
  if (sidecar.A.length === 0) return sidecar;
  if (!isAscii(source)) return undefined;

  let parsed: unknown;
  try {
    parsed = parser.parse(sidecar.f, source);
  } catch {
    return undefined;
  }
  const landmarks = parser.collectLandmarks(parsed);

  const A: AnchorRow[] = [];
  // `An` is strictly parallel to `A` (or absent altogether) — a dropped
  // row must drop its producer entry too, and a sidecar without the
  // optional pool stays without it.
  const producerIndices = sidecar.An;
  const An: number[] | undefined = producerIndices === undefined
    ? undefined
    : [];
  sidecar.A.forEach((row, index) => {
    const [
      landmarkIndex,
      pathIndex,
      generatorIndex,
      schemaIndex,
      variantIndex,
    ] = row;
    const landmarkName = sidecar.L[landmarkIndex] ?? "";
    if (landmarkName === "") return;
    const landmark = landmarks.get(landmarkName);
    if (landmark === undefined) return;
    const pathText = sidecar.P[pathIndex] ?? "";
    const path = pathText === "" ? [] : pathText.split(".").map(Number);
    const node = parser.descendPath(landmark, path);
    if (node === undefined) return;
    const span = parser.spanOf(node);
    A.push([
      landmarkIndex,
      pathIndex,
      generatorIndex,
      schemaIndex,
      variantIndex,
      span.start,
      span.end,
    ]);
    if (An !== undefined) An.push(producerIndices?.[index] ?? -1);
  });

  if (A.length === 0) return undefined;
  return An === undefined ? { ...sidecar, A } : { ...sidecar, A, An };
};
