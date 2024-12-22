export class OasInteger {
    constructor(fields) {
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
         * Constant value 'integer' useful for type narrowing and tagged unions.
         */
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'integer'
        });
        /**
         * A short summary of the integer.
         */
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * A description of the integer.
         */
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * Indicates whether value can be null.
         */
        Object.defineProperty(this, "nullable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * The format of the integer.
         */
        Object.defineProperty(this, "format", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * An array of allowed values for the integer.
         */
        Object.defineProperty(this, "enums", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Specification Extension fields */
        Object.defineProperty(this, "extensionFields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * An example of the integer.
         */
        Object.defineProperty(this, "example", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.title = fields.title;
        this.description = fields.description;
        this.nullable = fields.nullable;
        this.format = fields.format;
        this.enums = fields.enums;
        this.extensionFields = fields.extensionFields;
        this.example = fields.example;
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
