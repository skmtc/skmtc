"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.join = join;
const _os_js_1 = require("./_os.js");
const join_js_1 = require("./posix/join.js");
const join_js_2 = require("./windows/join.js");
/**
 * Joins a sequence of paths, then normalizes the resulting path.
 *
 * @example Usage
 * ```ts
 * import { join } from "@std/path/join";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(join("C:\\foo", "bar", "baz\\quux", "garply", ".."), "C:\\foo\\bar\\baz\\quux");
 * } else {
 *   assertEquals(join("/foo", "bar", "baz/quux", "garply", ".."), "/foo/bar/baz/quux");
 * }
 * ```
 *
 * Note: If you are working with file URLs,
 * use the new version of `join` from `@std/path/unstable-join`.
 *
 * @param paths Paths to be joined and normalized.
 * @returns The joined and normalized path.
 */
function join(...paths) {
    return _os_js_1.isWindows ? (0, join_js_2.join)(...paths) : (0, join_js_1.join)(...paths);
}
