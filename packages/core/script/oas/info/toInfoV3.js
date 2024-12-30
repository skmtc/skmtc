"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toInfoV3 = void 0;
const Info_js_1 = require("./Info.js");
const toContactV3_js_1 = require("../contact/toContactV3.js");
const toLicenseV3_js_1 = require("../license/toLicenseV3.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toInfoV3 = ({ info, context }) => {
    const { title, description, termsOfService, contact, license, version, ...skipped } = info;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    return new Info_js_1.OasInfo({
        title,
        description,
        termsOfService,
        contact: contact ? (0, toContactV3_js_1.toContactV3)(contact, context) : undefined,
        license: license ? (0, toLicenseV3_js_1.toLicenseV3)(license, context) : undefined,
        version,
        extensionFields
    });
};
exports.toInfoV3 = toInfoV3;
