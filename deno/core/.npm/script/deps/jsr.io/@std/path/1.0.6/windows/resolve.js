"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = resolve;
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
const dntShim = __importStar(require("../../../../../../_dnt.shims.js"));
const constants_js_1 = require("../_common/constants.js");
const normalize_string_js_1 = require("../_common/normalize_string.js");
const assert_path_js_1 = require("../_common/assert_path.js");
const _util_js_1 = require("./_util.js");
/**
 * Resolves path segments into a `path`.
 *
 * @example Usage
 * ```ts
 * import { resolve } from "@std/path/windows/resolve";
 * import { assertEquals } from "@std/assert";
 *
 * const resolved = resolve("C:\\foo\\bar", "..\\baz");
 * assertEquals(resolved, "C:\\foo\\baz");
 * ```
 *
 * @param pathSegments The path segments to process to path
 * @returns The resolved path
 */
function resolve(...pathSegments) {
    let resolvedDevice = "";
    let resolvedTail = "";
    let resolvedAbsolute = false;
    for (let i = pathSegments.length - 1; i >= -1; i--) {
        let path;
        // deno-lint-ignore no-explicit-any
        const { Deno } = dntShim.dntGlobalThis;
        if (i >= 0) {
            path = pathSegments[i];
        }
        else if (!resolvedDevice) {
            if (typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a drive-letter-less path without a current working directory (CWD)");
            }
            path = Deno.cwd();
        }
        else {
            if (typeof Deno?.env?.get !== "function" || typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a current working directory (CWD)");
            }
            path = Deno.cwd();
            // Verify that a cwd was found and that it actually points
            // to our drive. If not, default to the drive's root.
            if (path === undefined ||
                path.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
                path = `${resolvedDevice}\\`;
            }
        }
        (0, assert_path_js_1.assertPath)(path);
        const len = path.length;
        // Skip empty entries
        if (len === 0)
            continue;
        let rootEnd = 0;
        let device = "";
        let isAbsolute = false;
        const code = path.charCodeAt(0);
        // Try to match a root
        if (len > 1) {
            if ((0, _util_js_1.isPathSeparator)(code)) {
                // Possible UNC root
                // If we started with a separator, we know we at least have an
                // absolute path of some kind (UNC or otherwise)
                isAbsolute = true;
                if ((0, _util_js_1.isPathSeparator)(path.charCodeAt(1))) {
                    // Matched double path separator at beginning
                    let j = 2;
                    let last = j;
                    // Match 1 or more non-path separators
                    for (; j < len; ++j) {
                        if ((0, _util_js_1.isPathSeparator)(path.charCodeAt(j)))
                            break;
                    }
                    if (j < len && j !== last) {
                        const firstPart = path.slice(last, j);
                        // Matched!
                        last = j;
                        // Match 1 or more path separators
                        for (; j < len; ++j) {
                            if (!(0, _util_js_1.isPathSeparator)(path.charCodeAt(j)))
                                break;
                        }
                        if (j < len && j !== last) {
                            // Matched!
                            last = j;
                            // Match 1 or more non-path separators
                            for (; j < len; ++j) {
                                if ((0, _util_js_1.isPathSeparator)(path.charCodeAt(j)))
                                    break;
                            }
                            if (j === len) {
                                // We matched a UNC root only
                                device = `\\\\${firstPart}\\${path.slice(last)}`;
                                rootEnd = j;
                            }
                            else if (j !== last) {
                                // We matched a UNC root with leftovers
                                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                                rootEnd = j;
                            }
                        }
                    }
                }
                else {
                    rootEnd = 1;
                }
            }
            else if ((0, _util_js_1.isWindowsDeviceRoot)(code)) {
                // Possible device root
                if (path.charCodeAt(1) === constants_js_1.CHAR_COLON) {
                    device = path.slice(0, 2);
                    rootEnd = 2;
                    if (len > 2) {
                        if ((0, _util_js_1.isPathSeparator)(path.charCodeAt(2))) {
                            // Treat separator following drive name as an absolute path
                            // indicator
                            isAbsolute = true;
                            rootEnd = 3;
                        }
                    }
                }
            }
        }
        else if ((0, _util_js_1.isPathSeparator)(code)) {
            // `path` contains just a path separator
            rootEnd = 1;
            isAbsolute = true;
        }
        if (device.length > 0 &&
            resolvedDevice.length > 0 &&
            device.toLowerCase() !== resolvedDevice.toLowerCase()) {
            // This path points to another device so it is not applicable
            continue;
        }
        if (resolvedDevice.length === 0 && device.length > 0) {
            resolvedDevice = device;
        }
        if (!resolvedAbsolute) {
            resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
            resolvedAbsolute = isAbsolute;
        }
        if (resolvedAbsolute && resolvedDevice.length > 0)
            break;
    }
    // At this point the path should be resolved to a full absolute path,
    // but handle relative paths to be safe (might happen when Deno.cwd()
    // fails)
    // Normalize the tail path
    resolvedTail = (0, normalize_string_js_1.normalizeString)(resolvedTail, !resolvedAbsolute, "\\", _util_js_1.isPathSeparator);
    return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}
