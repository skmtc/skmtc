"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeekMode = void 0;
/**
 * A enum which defines the seek mode for IO related APIs that support
 * seeking.
 */
var SeekMode;
(function (SeekMode) {
    /* Seek from the start of the file/resource. */
    SeekMode[SeekMode["Start"] = 0] = "Start";
    /* Seek from the current position within the file/resource. */
    SeekMode[SeekMode["Current"] = 1] = "Current";
    /* Seek from the end of the current file/resource. */
    SeekMode[SeekMode["End"] = 2] = "End";
})(SeekMode || (exports.SeekMode = SeekMode = {}));
