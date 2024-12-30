import { ValueBase } from '../dsl/ValueBase.js';
export class CustomValue extends ValueBase {
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
export const isCustomValue = (value) => {
    return Boolean(value && typeof value === 'object' && 'type' in value && value.type === 'custom');
};
