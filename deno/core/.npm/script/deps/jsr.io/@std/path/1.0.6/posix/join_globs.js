"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinGlobs = joinGlobs;
const join_js_1 = require("./join.js");
const constants_js_1 = require("./constants.js");
const normalize_glob_js_1 = require("./normalize_glob.js");
/**
 * Like join(), but doesn't collapse "**\/.." when `globstar` is true.
 *
 * @example Usage
 * ```ts
 * import { joinGlobs } from "@std/path/posix/join-globs";
 * import { assertEquals } from "@std/assert";
 *
 * const path = joinGlobs(["foo", "bar", "**"], { globstar: true });
 * assertEquals(path, "foo/bar/**");
 * ```
 *
 * @param globs The globs to join.
 * @param options The options to use.
 * @returns The joined path.
 */
function joinGlobs(globs, { extended = true, globstar = false } = {}) {
    if (!globstar || globs.length === 0) {
        return (0, join_js_1.join)(...globs);
    }
    let joined;
    for (const glob of globs) {
        const path = glob;
        if (path.length > 0) {
            if (!joined)
                joined = path;
            else
                joined += `${constants_js_1.SEPARATOR}${path}`;
        }
    }
    if (!joined)
        return ".";
    return (0, normalize_glob_js_1.normalizeGlob)(joined, { extended, globstar });
}
