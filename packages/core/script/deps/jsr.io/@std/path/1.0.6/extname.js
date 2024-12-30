"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.extname = extname;
const _os_js_1 = require("./_os.js");
const extname_js_1 = require("./posix/extname.js");
const extname_js_2 = require("./windows/extname.js");
/**
 * Return the extension of the path with leading period (".").
 *
 * @example Usage
 * ```ts
 * import { extname } from "@std/path/extname";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(extname("C:\\home\\user\\Documents\\image.png"), ".png");
 * } else {
 *   assertEquals(extname("/home/user/Documents/image.png"), ".png");
 * }
 * ```
 *
 * Note: If you are working with file URLs,
 * use the new version of `extname` from `@std/path/unstable-extname`.
 *
 * @param path Path with extension.
 * @returns The file extension. E.g. returns `.ts` for `file.ts`.
 */
function extname(path) {
    return _os_js_1.isWindows ? (0, extname_js_2.extname)(path) : (0, extname_js_1.extname)(path);
}
