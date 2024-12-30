import { OasInfo } from './Info.js';
import { toContactV3 } from '../contact/toContactV3.js';
import { toLicenseV3 } from '../license/toLicenseV3.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toInfoV3 = ({ info, context }) => {
    const { title, description, termsOfService, contact, license, version, ...skipped } = info;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    return new OasInfo({
        title,
        description,
        termsOfService,
        contact: contact ? toContactV3(contact, context) : undefined,
        license: license ? toLicenseV3(license, context) : undefined,
        version,
        extensionFields
    });
};
