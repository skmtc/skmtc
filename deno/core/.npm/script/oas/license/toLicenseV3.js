"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLicenseV3 = void 0;
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const License_js_1 = require("./License.js");
const toLicenseV3 = (license, context) => {
    const { name, url, ...skipped } = license;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    return new License_js_1.OasLicense({
        name,
        url,
        extensionFields
    });
};
exports.toLicenseV3 = toLicenseV3;
