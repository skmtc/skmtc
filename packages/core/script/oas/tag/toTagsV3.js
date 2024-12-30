"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTagV3 = exports.toTagsV3 = void 0;
const Tag_js_1 = require("./Tag.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toTagsV3 = ({ tags, context }) => {
    if (!tags) {
        return undefined;
    }
    return tags.map(tag => (0, exports.toTagV3)({ tag, context }));
};
exports.toTagsV3 = toTagsV3;
const toTagV3 = ({ tag, context }) => {
    const { name, description, ...skipped } = tag;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    const fields = {
        name,
        description,
        extensionFields
    };
    return new Tag_js_1.OasTag(fields);
};
exports.toTagV3 = toTagV3;
