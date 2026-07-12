import { assertEquals, assertExists } from "@std/assert";
import { oxcAdapter } from "./oxcAdapter.ts";

// --- collectLandmarks: every named top-level declaration -------------------

Deno.test("collectLandmarks - indexes non-exported top-level declarations", () => {
  const source = [
    "import { helper } from './helper.ts'",
    "const columnHelper = helper<number>()",
    "function localFn() { return 1 }",
    "type LocalType = { a: string }",
    "export const columns = [columnHelper]",
    "export type PublicType = LocalType",
  ].join("\n");
  const parsed = oxcAdapter.parse("landmarks.ts", source);
  const landmarks = oxcAdapter.collectLandmarks(parsed);
  assertEquals(
    [...landmarks.keys()].sort(),
    ["LocalType", "PublicType", "columnHelper", "columns", "localFn"],
  );
});

Deno.test("collectLandmarks - first declaration wins on duplicate names", () => {
  const source = ["export const dup = 1", "namespace n { }"].join("\n");
  const parsed = oxcAdapter.parse("dup.ts", source);
  const landmarks = oxcAdapter.collectLandmarks(parsed);
  assertExists(landmarks.get("dup"));
});

// --- descendPath / spanOf: the re-anchor round-trip -------------------------

Deno.test("descendPath - empty path returns the landmark itself", () => {
  const parsed = oxcAdapter.parse("a.ts", "export const x = 1");
  const landmark = oxcAdapter.collectLandmarks(parsed).get("x");
  assertExists(landmark);
  assertEquals(oxcAdapter.descendPath(landmark, []), landmark);
});

Deno.test("descendPath - out-of-range index returns undefined", () => {
  const parsed = oxcAdapter.parse("a.ts", "export const x = 1");
  const landmark = oxcAdapter.collectLandmarks(parsed).get("x");
  assertExists(landmark);
  assertEquals(oxcAdapter.descendPath(landmark, [99]), undefined);
});

Deno.test("spanOf - returns the source range of a landmark statement", () => {
  const source = "const before = 0\nexport const x = 1";
  const parsed = oxcAdapter.parse("a.ts", source);
  const landmark = oxcAdapter.collectLandmarks(parsed).get("x");
  assertExists(landmark);
  const span = oxcAdapter.spanOf(landmark);
  assertEquals(source.slice(span.start, span.end), "export const x = 1");
});

// --- JSX reflow stability: the whole point ----------------------------------

const normalizeWs = (text: string): string => text.replace(/\s+/g, "");

Deno.test("paths survive a formatter JSX reflow (whitespace JSXText filtered)", () => {
  // Raw engine render: single-line JSX child.
  const raw = [
    "export const Widget = () => {",
    "  return (",
    "    <div>",
    "      <span>{items.map(item => <b key={item}>{item}</b>)}</span>",
    "    </div>",
    "  )",
    "}",
  ].join("\n");
  // The same file after a formatter reflows the <span> body across
  // lines — introducing whitespace-only JSXText children around the
  // expression container (the exact shape oxfmt produced on reapit).
  const formatted = [
    "export const Widget = () => {",
    "  return (",
    "    <div>",
    "      <span>",
    "        {items.map((item) => (",
    "          <b key={item}>",
    "            {item}",
    "          </b>",
    "        ))}",
    "      </span>",
    "    </div>",
    "  );",
    "};",
  ].join("\n");

  const rawParsed = oxcAdapter.parse("w.tsx", raw);
  const rawLandmarks = oxcAdapter.collectLandmarks(rawParsed);

  // Anchor on the `{items.map(...)}` expression container in the raw text.
  const target = "{items.map(";
  const from = raw.indexOf(target);
  const node = oxcAdapter.smallestEnclosing(
    rawParsed,
    from,
    from + target.length,
  );
  const location = oxcAdapter.ascendToLandmark(node, rawLandmarks);
  assertEquals(location.landmark, "Widget");

  const formattedParsed = oxcAdapter.parse("w.tsx", formatted);
  const formattedLandmark = oxcAdapter.collectLandmarks(formattedParsed).get(
    "Widget",
  );
  assertExists(formattedLandmark);
  const reanchored = oxcAdapter.descendPath(formattedLandmark, location.path);
  assertExists(reanchored);

  const rawSpan = oxcAdapter.spanOf(node);
  const reanchoredSpan = oxcAdapter.spanOf(reanchored);
  const rawSlice = raw.slice(rawSpan.start, rawSpan.end);
  const formattedSlice = formatted.slice(
    reanchoredSpan.start,
    reanchoredSpan.end,
  );
  // Same node, modulo the formatter's whitespace + arrow-paren cosmetics.
  assertEquals(
    normalizeWs(rawSlice).replaceAll("(", "").replaceAll(")", ""),
    normalizeWs(formattedSlice).replaceAll("(", "").replaceAll(")", ""),
  );
});
