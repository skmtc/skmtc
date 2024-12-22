"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelBase = void 0;
const ValueBase_js_1 = require("../ValueBase.js");
class ModelBase extends ValueBase_js_1.ValueBase {
    constructor({ context, settings, generatorKey, refName }) {
        super({ context });
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "refName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "generatorKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.generatorKey = generatorKey;
        this.refName = refName;
        this.settings = settings;
    }
    insertModel(insertable, refName) {
        return this.context.insertModel({
            insertable,
            refName,
            generation: 'force',
            destinationPath: this.settings.exportPath
        });
    }
    register(args) {
        this.context.register({
            ...args,
            destinationPath: this.settings.exportPath
        });
    }
}
exports.ModelBase = ModelBase;
