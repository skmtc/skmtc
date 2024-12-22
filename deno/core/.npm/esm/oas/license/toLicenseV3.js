import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
import { OasLicense } from './License.js';
export const toLicenseV3 = (license, context) => {
    const { name, url, ...skipped } = license;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    return new OasLicense({
        name,
        url,
        extensionFields
    });
};
