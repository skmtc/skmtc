/**
 * Return the directory path of a `path`.
 *
 * @example Usage
 * ```ts
 * import { dirname } from "@std/path/posix/dirname";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(dirname("/home/user/Documents/"), "/home/user");
 * assertEquals(dirname("/home/user/Documents/image.png"), "/home/user/Documents");
 * ```
 *
 * Note: If you are working with file URLs,
 * use the new version of `dirname` from `@std/path/posix/unstable-dirname`.
 *
 * @param path The path to get the directory from.
 * @returns The directory path.
 */
export declare function dirname(path: string): string;
//# sourceMappingURL=dirname.d.ts.map