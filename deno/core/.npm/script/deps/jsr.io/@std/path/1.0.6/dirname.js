"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.dirname = dirname;
const _os_js_1 = require("./_os.js");
const dirname_js_1 = require("./posix/dirname.js");
const dirname_js_2 = require("./windows/dirname.js");
/**
 * Return the directory path of a path.
 *
 * @example Usage
 * ```ts
 * import { dirname } from "@std/path/dirname";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(dirname("C:\\home\\user\\Documents\\image.png"), "C:\\home\\user\\Documents");
 * } else {
 *   assertEquals(dirname("/home/user/Documents/image.png"), "/home/user/Documents");
 * }
 * ```
 *
 * Note: If you are working with file URLs,
 * use the new version of `dirname` from `@std/path/unstable-dirname`.
 *
 * @param path Path to extract the directory from.
 * @returns The directory path.
 */
function dirname(path) {
    return _os_js_1.isWindows ? (0, dirname_js_2.dirname)(path) : (0, dirname_js_1.dirname)(path);
}
