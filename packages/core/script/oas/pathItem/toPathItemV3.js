"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPathItemV3 = void 0;
const toParameterV3_js_1 = require("../parameter/toParameterV3.js");
const PathItem_js_1 = require("./PathItem.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toPathItemV3 = ({ pathItem, context }) => {
    const { summary, description, parameters, ...skipped } = pathItem;
    return new PathItem_js_1.OasPathItem({
        summary,
        description,
        parameters: context.trace('parameters', () => (0, toParameterV3_js_1.toParameterListV3)({ parameters, context })),
        extensionFields: (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({ skipped, context })
    });
};
exports.toPathItemV3 = toPathItemV3;
