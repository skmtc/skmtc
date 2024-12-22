"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.DEFAULT_LEVEL = void 0;
const console_handler_js_1 = require("./console_handler.js");
exports.DEFAULT_LEVEL = "INFO";
exports.DEFAULT_CONFIG = {
    handlers: {
        default: new console_handler_js_1.ConsoleHandler(exports.DEFAULT_LEVEL),
    },
    loggers: {
        default: {
            level: exports.DEFAULT_LEVEL,
            handlers: ["default"],
        },
    },
};
