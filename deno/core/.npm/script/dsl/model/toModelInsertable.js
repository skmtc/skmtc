"use strict";
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toModelInsertable = void 0;
const GeneratorKeys_js_1 = require("../../types/GeneratorKeys.js");
const ModelBase_js_1 = require("./ModelBase.js");
const toModelInsertable = (config) => {
    var _a;
    const ModelInsertable = (_a = class extends ModelBase_js_1.ModelBase {
            constructor(args) {
                super({
                    ...args,
                    generatorKey: (0, GeneratorKeys_js_1.toModelGeneratorKey)({
                        generatorId: config.id,
                        refName: args.refName
                    })
                });
            }
        },
        __setFunctionName(_a, "ModelInsertable"),
        Object.defineProperty(_a, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.id
        }),
        Object.defineProperty(_a, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'model'
        }),
        Object.defineProperty(_a, "_class", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ModelInsertable'
        }),
        Object.defineProperty(_a, "toIdentifier", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.toIdentifier.bind(config)
        }),
        Object.defineProperty(_a, "toExportPath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: config.toExportPath.bind(config)
        }),
        Object.defineProperty(_a, "isSupported", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => true
        }),
        Object.defineProperty(_a, "pinnable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        }),
        _a);
    return ModelInsertable;
};
exports.toModelInsertable = toModelInsertable;
