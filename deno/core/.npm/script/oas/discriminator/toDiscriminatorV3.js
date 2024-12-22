"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDiscriminatorV3 = void 0;
const Discriminator_js_1 = require("./Discriminator.js");
const toDiscriminatorV3 = ({ discriminator, context }) => {
    if (!discriminator) {
        return undefined;
    }
    const { propertyName, ...skipped } = discriminator;
    context.logSkippedFields(skipped);
    const fields = {
        propertyName
    };
    return new Discriminator_js_1.OasDiscriminator(fields);
};
exports.toDiscriminatorV3 = toDiscriminatorV3;
