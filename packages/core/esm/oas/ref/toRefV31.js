import { OasRef } from './Ref.js';
export const toRefV31 = ({ ref, refType, context }) => {
    const { $ref, summary, description, ...skipped } = ref;
    context.logSkippedFields(skipped);
    const fields = {
        refType,
        $ref,
        summary,
        description
    };
    return new OasRef(fields, context.oasDocument);
};
