import { CbFunction } from "./_loader/loader.js";
import type { LoaderStateOptions } from "./_loader/loader_state.js";
export type ParseOptions = LoaderStateOptions;
/**
 * Parses `content` as single YAML document.
 *
 * Returns a JavaScript object or throws `YAMLError` on error.
 * By default, does not support regexps, functions and undefined. This method is safe for untrusted data.
 */
export declare function parse(content: string, options?: ParseOptions): unknown;
/**
 * Same as `parse()`, but understands multi-document sources.
 * Applies iterator to each document if specified, or returns array of documents.
 *
 * @example
 * ```ts
 * import { parseAll } from "@std/yaml/parse";
 *
 * const data = parseAll(`
 * ---
 * id: 1
 * name: Alice
 * ---
 * id: 2
 * name: Bob
 * ---
 * id: 3
 * name: Eve
 * `);
 * console.log(data);
 * // => [ { id: 1, name: "Alice" }, { id: 2, name: "Bob" }, { id: 3, name: "Eve" } ]
 * ```
 */
export declare function parseAll(content: string, iterator: CbFunction, options?: ParseOptions): void;
export declare function parseAll(content: string, options?: ParseOptions): unknown;
//# sourceMappingURL=parse.d.ts.map