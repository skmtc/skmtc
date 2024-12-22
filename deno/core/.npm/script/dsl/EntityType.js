"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityType = void 0;
const ts_pattern_1 = require("ts-pattern");
class EntityType {
    constructor(type) {
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.type = type;
    }
    toString() {
        return (0, ts_pattern_1.match)(this.type)
            .with('variable', () => 'const')
            .with('type', () => 'type')
            .exhaustive();
    }
}
exports.EntityType = EntityType;
