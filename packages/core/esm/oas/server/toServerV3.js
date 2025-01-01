import { OasServer } from './Server.js';
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.js';
export const toServersV3 = ({ servers, context }) => {
    return servers.map((server, index) => {
        return context.trace(server.url ?? index, () => toServerV3({ server, context }));
    });
};
export const toOptionalServersV3 = ({ servers, context }) => {
    if (!servers) {
        return undefined;
    }
    return toServersV3({ servers, context });
};
export const toServerV3 = ({ server, context }) => {
    const { description, url, ...skipped } = server;
    const extensionFields = toSpecificationExtensionsV3({
        skipped,
        context
    });
    const fields = {
        description,
        url,
        extensionFields
    };
    return new OasServer(fields);
};
