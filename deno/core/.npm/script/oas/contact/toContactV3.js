"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toContactV3 = void 0;
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const Contact_js_1 = require("./Contact.js");
const toContactV3 = (contact, context) => {
    const { name, url, email, ...skipped } = contact;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    return new Contact_js_1.OasContact({
        name,
        url,
        email,
        extensionFields
    });
};
exports.toContactV3 = toContactV3;
