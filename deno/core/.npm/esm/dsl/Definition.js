import { ValueBase } from './ValueBase.js';
import { withDescription } from '../typescript/withDescription.js';
export class Definition extends ValueBase {
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
        return withDescription(`export ${this.identifier.entityType} ${identifier} = ${this.value};`, {
            description: this.description
        });
    }
}
