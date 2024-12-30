"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toRefV31 = void 0;
const Ref_js_1 = require("./Ref.js");
const toRefV31 = ({ ref, refType, context }) => {
    const { $ref, summary, description, ...skipped } = ref;
    context.logSkippedFields(skipped);
    const fields = {
        refType,
        $ref,
        summary,
        description
    };
    return new Ref_js_1.OasRef(fields, context.oasDocument);
};
exports.toRefV31 = toRefV31;
