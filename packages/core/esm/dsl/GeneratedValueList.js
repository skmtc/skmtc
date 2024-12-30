import { EMPTY } from './constants.js';
export class GeneratedValueList {
    constructor(separator) {
        Object.defineProperty(this, "separator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "items", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.separator = separator;
    }
    add(str) {
        this.items.push(str);
    }
    toString() {
        return this.items
            .map(item => item.toString())
            .filter(item => item !== EMPTY)
            .join(this.separator);
    }
}
