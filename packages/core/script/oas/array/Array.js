"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OasArray = void 0;
/**
 * Object representing an array in the OpenAPI Specification.
 */
class OasArray {
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
         * Constant value 'array' useful for type narrowing and tagged unions.
         */
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'array'
        });
        /**
         * Defines the type of items in the array.
         */
        Object.defineProperty(this, "items", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * A short summary of the array.
         */
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * A description of the array.
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
         * Indicates whether the array items must be unique.
         */
        Object.defineProperty(this, "uniqueItems", {
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
         * An example of the array.
         */
        Object.defineProperty(this, "example", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.items = fields.items;
        this.title = fields.title;
        this.description = fields.description;
        this.nullable = fields.nullable;
        this.uniqueItems = fields.uniqueItems;
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
    toJsonSchema(options) {
        return {
            type: 'array',
            items: this.items.toJsonSchema(options),
            title: this.title,
            description: this.description,
            nullable: this.nullable,
            example: this.example
        };
    }
}
exports.OasArray = OasArray;
