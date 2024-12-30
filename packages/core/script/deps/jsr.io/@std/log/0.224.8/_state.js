"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = void 0;
const _config_js_1 = require("./_config.js");
exports.state = {
    handlers: new Map(),
    loggers: new Map(),
    config: _config_js_1.DEFAULT_CONFIG,
};
