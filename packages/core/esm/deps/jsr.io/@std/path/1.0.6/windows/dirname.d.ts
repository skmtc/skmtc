/**
 * Return the directory path of a `path`.
 *
 * @example Usage
 * ```ts
 * import { dirname } from "@std/path/windows/dirname";
 * import { assertEquals } from "@std/assert";
 *
 * const dir = dirname("C:\\foo\\bar\\baz.ext");
 * assertEquals(dir, "C:\\foo\\bar");
 * ```
 *
 * Note: If you are working with file URLs,
 * use the new version of `dirname` from `@std/path/windows/unstable-dirname`.
 *
 * @param path The path to get the directory from.
 * @returns The directory path.
 */
export declare function dirname(path: string): string;
//# sourceMappingURL=dirname.d.ts.map