"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUnion = void 0;
const Union_js_1 = require("./Union.js");
const toDiscriminatorV3_js_1 = require("../discriminator/toDiscriminatorV3.js");
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toUnion = ({ value, members, context }) => {
    const { discriminator, title, description, nullable, example, ...skipped } = value;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    return new Union_js_1.OasUnion({
        title,
        description,
        nullable,
        discriminator: context.trace('discriminator', () => (0, toDiscriminatorV3_js_1.toDiscriminatorV3)({ discriminator, context })),
        members: members.map((schema, index) => context.trace(`${index}`, () => (0, toSchemasV3_js_1.toSchemaV3)({ schema, context }))),
        example,
        extensionFields
    });
};
exports.toUnion = toUnion;
