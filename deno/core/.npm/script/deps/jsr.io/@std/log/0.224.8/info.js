"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.info = info;
const get_logger_js_1 = require("./get_logger.js");
function info(msg, ...args) {
    // Assist TS compiler with pass-through generic type
    if (msg instanceof Function) {
        return (0, get_logger_js_1.getLogger)("default").info(msg, ...args);
    }
    return (0, get_logger_js_1.getLogger)("default").info(msg, ...args);
}
