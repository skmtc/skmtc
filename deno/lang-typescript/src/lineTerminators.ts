/**
 * The four line terminators JavaScript ends a line on, each with the escape
 * that stands for it. A string literal cannot hold one as is, and neither
 * can a regex literal; the same escape works in both, with or without the
 * regex `u` flag.
 */
export const lineTerminatorEscapes: ReadonlyMap<string, string> = new Map([
  ['\n', '\\n'],
  ['\r', '\\r'],
  [String.fromCharCode(0x2028), '\\u2028'],
  [String.fromCharCode(0x2029), '\\u2029']
])
