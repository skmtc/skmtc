/**
 * Object representing a void type in the OpenAPI Specification.
 * It is used to describe an absence of a value such as when no
 * content is returned by an operation.
 */
export class OasVoid {
    constructor(fields = {}) {
        /**
         * Object is part the 'schema' set which is used
         * to define data types in an OpenAPI document.
         */
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'schema'
        });
        /**
         * Constant value 'void' useful for type narrowing and tagged unions.
         */
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'void'
        });
        /**
         * A short summary of the value.
         */
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * A description of the value.
         */
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.title = fields.title;
        this.description = fields.description;
    }
    static empty() {
        return new OasVoid();
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
}
