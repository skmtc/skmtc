"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.critical = critical;
const get_logger_js_1 = require("./get_logger.js");
function critical(msg, ...args) {
    // Assist TS compiler with pass-through generic type
    if (msg instanceof Function) {
        return (0, get_logger_js_1.getLogger)("default").critical(msg, ...args);
    }
    return (0, get_logger_js_1.getLogger)("default").critical(msg, ...args);
}
