"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Definition = void 0;
const ValueBase_js_1 = require("./ValueBase.js");
const withDescription_js_1 = require("../typescript/withDescription.js");
class Definition extends ValueBase_js_1.ValueBase {
    constructor({ context, identifier, value, description }) {
        super({ context, generatorKey: value.generatorKey });
        Object.defineProperty(this, "identifier", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.value = value;
        this.identifier = identifier;
        this.description = description;
    }
    toString() {
        const identifier = this.identifier.typeName
            ? `${this.identifier.name}: ${this.identifier.typeName}`
            : this.identifier.name;
        // @TODO move syntax to typescript package to enable language agnostic use
        return (0, withDescription_js_1.withDescription)(`export ${this.identifier.entityType} ${identifier} = ${this.value};`, {
            description: this.description
        });
    }
}
exports.Definition = Definition;
