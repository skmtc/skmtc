/**
 * Object representing a 'oneOf' or 'anyOf' in the OpenAPI Specification.
 *
 * In the context of TypeScript 'anyOf' is not helpful since it implies
 * a union that consists of all possible combinations of member types.
 *
 * Generating such combination types would not be useful and we map both
 * 'oneOf' and 'anyOf' to a TypeScript union type.
 */
export class OasUnion {
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
         * Constant value 'union' useful for type narrowing and tagged unions.
         */
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'union'
        });
        /**
         * A short summary of the union.
         */
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * A description of the union.
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
         * Discriminator object used to tag member types and make the union a tagged union.
         */
        Object.defineProperty(this, "discriminator", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * Array of schemas or references to schemas that are part of the union.
         */
        Object.defineProperty(this, "members", {
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
         * An example of the union type.
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
        this.discriminator = fields.discriminator;
        this.members = fields.members;
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
            title: this.title,
            description: this.description,
            nullable: this.nullable,
            example: this.example,
            oneOf: this.members.map(member => member.toJsonSchema(options))
        };
    }
}
