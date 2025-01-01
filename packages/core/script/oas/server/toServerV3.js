"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toServerV3 = exports.toOptionalServersV3 = exports.toServersV3 = void 0;
const Server_js_1 = require("./Server.js");
const toSpecificationExtensionsV3_js_1 = require("../specificationExtensions/toSpecificationExtensionsV3.js");
const toServersV3 = ({ servers, context }) => {
    return servers.map((server, index) => {
        return context.trace(server.url ?? index, () => (0, exports.toServerV3)({ server, context }));
    });
};
exports.toServersV3 = toServersV3;
const toOptionalServersV3 = ({ servers, context }) => {
    if (!servers) {
        return undefined;
    }
    return (0, exports.toServersV3)({ servers, context });
};
exports.toOptionalServersV3 = toOptionalServersV3;
const toServerV3 = ({ server, context }) => {
    const { description, url, ...skipped } = server;
    const extensionFields = (0, toSpecificationExtensionsV3_js_1.toSpecificationExtensionsV3)({
        skipped,
        context
    });
    const fields = {
        description,
        url,
        extensionFields
    };
    return new Server_js_1.OasServer(fields);
};
exports.toServerV3 = toServerV3;
