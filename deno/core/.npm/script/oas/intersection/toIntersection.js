"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIntersection = void 0;
const Intersection_js_1 = require("./Intersection.js");
const toDiscriminatorV3_js_1 = require("../discriminator/toDiscriminatorV3.js");
const toSchemasV3_js_1 = require("../schema/toSchemasV3.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toIntersection = ({ value, members, context }) => {
    const { discriminator, title, description, nullable, ...skipped } = value;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context });
    return new Intersection_js_1.OasIntersection({
        title,
        description,
        nullable,
        discriminator: context.trace('discriminator', () => (0, toDiscriminatorV3_js_1.toDiscriminatorV3)({ discriminator, context })),
        members: members.map((schema, index) => context.trace(`${index}`, () => (0, toSchemasV3_js_1.toSchemaV3)({ schema, context }))),
        extensionFields
    });
};
exports.toIntersection = toIntersection;
