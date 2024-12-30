"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toEnrichments = void 0;
const handleEnrichment_js_1 = require("./handleEnrichment.js");
const toEnrichments = async ({ generators, oasDocument }) => {
    const responses = [];
    for (const generator of generators) {
        if (generator.type === 'operation') {
            for (const operation of oasDocument.operations) {
                const enrichmentRequest = generator.toEnrichmentRequest?.(operation);
                if (enrichmentRequest) {
                    const enrichmentResponse = (0, handleEnrichment_js_1.handleEnrichment)(enrichmentRequest);
                    responses.push({
                        generatorId: generator.id,
                        key: ['operations', operation.path, operation.method, 'enrichments'],
                        value: enrichmentResponse
                    });
                }
            }
        }
        else if (generator.type === 'model') {
            for (const [refName, schema] of Object.entries(oasDocument.components?.schemas ?? {})) {
                const enrichmentRequest = generator.toEnrichmentRequest?.(refName);
                if (enrichmentRequest) {
                    const enrichmentResponse = (0, handleEnrichment_js_1.handleEnrichment)(enrichmentRequest);
                    responses.push({
                        generatorId: generator.id,
                        key: ['models', refName, 'enrichments'],
                        value: enrichmentResponse
                    });
                }
            }
        }
    }
    const items = await Promise.all(responses.map(async (response) => {
        return {
            generatorId: response.generatorId,
            key: response.key,
            value: await response.value
        };
    }));
    return items.reduce((acc, { generatorId, key, value }) => {
        acc[generatorId] = acc[generatorId] || [];
        acc[generatorId].push({
            key,
            value: JSON.parse(value)
        });
        return acc;
    }, {});
};
exports.toEnrichments = toEnrichments;
