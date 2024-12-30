import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
import { OasContact } from './Contact.js';
export const toContactV3 = (contact, context) => {
    const { name, url, email, ...skipped } = contact;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    return new OasContact({
        name,
        url,
        email,
        extensionFields
    });
};
