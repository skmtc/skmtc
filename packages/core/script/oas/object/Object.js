"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OasObject = void 0;
const ts_pattern_1 = require("ts-pattern");
/**
 * Object representing an object and/or a record in the OpenAPI Specification.
 *
 * Objects have fixed, named fields. Records have any number of fields that do not have predefined names.
 */
class OasObject {
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
         * Constant value 'object' useful for type narrowing and tagged unions.
         */
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'object'
        });
        /**
         * A short summary of the object.
         */
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * A description of the object.
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
         * A record which maps property names of the object to their schemas.
         */
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * An array of required property names.
         */
        Object.defineProperty(this, "required", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * Indicates whether additional properties are allowed.
         *
         * This is equivalent to a Record type in TypeScript.
         */
        Object.defineProperty(this, "additionalProperties", {
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
         * An example of the object.
         */
        Object.defineProperty(this, "example", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.title = fields.title;
        this.description = fields.description;
        this.properties = fields.properties;
        this.required = fields.required;
        this.additionalProperties = fields.additionalProperties;
        this.nullable = fields.nullable;
        this.extensionFields = fields.extensionFields;
        this.example = fields.example;
    }
    /** Creates new empty OasObject */
    static empty() {
        return new OasObject({
            properties: {},
            required: []
        });
    }
    /**
     * Adds a new property to the object.
     *
     * @param {AddPropertyArgs} args - The arguments for adding a property.
     * @param {string} args.name - The name of the property to add.
     * @param {OasSchema | OasRef<'schema'> | CustomValue | undefined} args.schema - The schema of the property to add.
     * @param {boolean} args.required - Whether the property is required.
     * @returns {OasObject} A new OasObject with the added property.
     */
    addProperty({ name, schema, required }) {
        if (!schema) {
            return this;
        }
        return new OasObject({
            title: this.title,
            description: this.description,
            properties: {
                ...this.properties,
                [name]: schema
            },
            required: required ? [...(this.required ?? []), name] : this.required,
            additionalProperties: this.additionalProperties,
            nullable: this.nullable,
            extensionFields: this.extensionFields
        });
    }
    /**
     * Removes a property from the object.
     *
     * @param {string} name - The name of the property to remove.
     * @returns {OasObject} A new OasObject with the removed property.
     */
    removeProperty(name) {
        if (!this.properties?.[name]) {
            return this;
        }
        const { [name]: _removed, ...properties } = this.properties;
        return new OasObject({
            title: this.title,
            description: this.description,
            properties,
            required: this.required?.filter(n => n !== name),
            additionalProperties: this.additionalProperties,
            nullable: this.nullable,
            extensionFields: this.extensionFields
        });
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
            type: 'object',
            title: this.title,
            description: this.description,
            nullable: this.nullable,
            example: this.example,
            properties: Object.fromEntries(Object.entries(this.properties ?? {})
                .filter(([_key, value]) => value.type !== 'custom')
                .map(([key, value]) => [
                key,
                value.toJsonSchema(options)
            ])),
            required: this.required,
            additionalProperties: (0, ts_pattern_1.match)(this.additionalProperties)
                .with(ts_pattern_1.P.nullish, () => false)
                .with(ts_pattern_1.P.boolean, value => value)
                .otherwise(value => value.toJsonSchema(options))
        };
    }
}
exports.OasObject = OasObject;
