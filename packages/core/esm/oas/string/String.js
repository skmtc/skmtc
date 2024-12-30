/**
 * Object representing a string in the OpenAPI Specification.
 */
export class OasString {
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
         * Constant value 'string' useful for type narrowing and tagged unions.
         */
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'string'
        });
        /**
         * A short summary of the string.
         */
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * A description of the string.
         */
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * The format of the string.
         */
        Object.defineProperty(this, "format", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * An array of allowed values for the string.
         */
        Object.defineProperty(this, "enums", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * The maximum length of the string.
         */
        Object.defineProperty(this, "maxLength", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * The minimum length of the string.
         */
        Object.defineProperty(this, "minLength", {
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
        /** Specification Extension fields */
        Object.defineProperty(this, "extensionFields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** An example of the string. */
        Object.defineProperty(this, "example", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.title = fields.title;
        this.description = fields.description;
        this.format = fields.format;
        this.enums = fields.enums;
        this.nullable = fields.nullable;
        this.extensionFields = fields.extensionFields;
        this.example = fields.example;
        this.maxLength = fields.maxLength;
        this.minLength = fields.minLength;
    }
    // get pattern() {
    //   return this.fields.pattern
    // }
    isRef() {
        return false;
    }
    resolve() {
        return this;
    }
    resolveOnce() {
        return this;
    }
    // deno-lint-ignore no-unused-vars
    toJsonSchema(options) {
        return {
            type: 'string',
            title: this.title,
            description: this.description,
            nullable: this.nullable,
            example: this.example,
            format: this.format,
            enum: this.enums,
            maxLength: this.maxLength,
            minLength: this.minLength
        };
    }
}
