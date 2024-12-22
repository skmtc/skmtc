"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCustomValue = exports.CustomValue = void 0;
const ValueBase_js_1 = require("../dsl/ValueBase.js");
class CustomValue extends ValueBase_js_1.ValueBase {
    constructor({ context, value, generatorKey }) {
        super({ context, generatorKey });
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'custom'
        });
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.value = value;
    }
    isRef() {
        return false;
    }
    resolve() {
        return this;
    }
    resolveOnce() {
        return this;
    }
    toString() {
        return `${this.value}`;
    }
}
exports.CustomValue = CustomValue;
const isCustomValue = (value) => {
    return Boolean(value && typeof value === 'object' && 'type' in value && value.type === 'custom');
};
exports.isCustomValue = isCustomValue;
