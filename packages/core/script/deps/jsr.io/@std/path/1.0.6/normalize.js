"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = normalize;
const _os_js_1 = require("./_os.js");
const normalize_js_1 = require("./posix/normalize.js");
const normalize_js_2 = require("./windows/normalize.js");
/**
 * Normalize the path, resolving `'..'` and `'.'` segments.
 *
 * Note: Resolving these segments does not necessarily mean that all will be
 * eliminated. A `'..'` at the top-level will be preserved, and an empty path is
 * canonically `'.'`.
 *
 * @example Usage
 * ```ts
 * import { normalize } from "@std/path/normalize";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(normalize("C:\\foo\\bar\\..\\baz\\quux"), "C:\\foo\\baz\\quux");
 * } else {
 *   assertEquals(normalize("/foo/bar/../baz/quux"), "/foo/baz/quux");
 * }
 * ```
 *
 * Note: If you are working with file URLs,
 * use the new version of `normalize` from `@std/path/unstable-normalize`.
 *
 * @param path Path to be normalized
 * @returns The normalized path.
 */
function normalize(path) {
    return _os_js_1.isWindows ? (0, normalize_js_2.normalize)(path) : (0, normalize_js_1.normalize)(path);
}
