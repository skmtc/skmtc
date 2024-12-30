import { match } from 'ts-pattern';
export const toSettings = ({ generators, clientSettings, defaultSelected, oasDocument }) => {
    const generatorsSettings = generators.map(generator => {
        const generatorSettings = clientSettings?.generators.find(({ id }) => id === generator.id);
        const generatorType = generator.type;
        return match(generatorType)
            .with('operation', () => {
            if (!generatorSettings) {
                return {
                    id: generator.id,
                    operations: toOperations({
                        generator: generator,
                        oasDocument,
                        defaultSelected,
                        operationsSettings: undefined
                    })
                };
            }
            return {
                ...generatorSettings,
                id: generator.id,
                operations: toOperations({
                    generator: generator,
                    oasDocument,
                    defaultSelected,
                    operationsSettings: 'operations' in generatorSettings ? generatorSettings.operations : undefined
                })
            };
        })
            .with('model', () => {
            if (!generatorSettings) {
                return {
                    id: generator.id,
                    models: toModels({
                        oasDocument,
                        defaultSelected,
                        modelsSettings: undefined
                    })
                };
            }
            return {
                ...generatorSettings,
                id: generator.id,
                models: toModels({
                    oasDocument,
                    defaultSelected,
                    modelsSettings: 'models' in generatorSettings ? generatorSettings.models : undefined
                })
            };
        })
            .otherwise(matched => {
            throw new Error(`Invalid generator type: '${matched}' for ${generator.id}`);
        });
    });
    return generatorsSettings;
};
const toModels = ({ defaultSelected, oasDocument, modelsSettings }) => {
    return Object.fromEntries(Object.keys(oasDocument.components?.schemas ?? {}).map(refName => [
        refName,
        modelsSettings?.[refName]
            ? modelsSettings?.[refName]
            : { selected: defaultSelected, enrichments: undefined }
    ]));
};
const toOperations = ({ oasDocument, operationsSettings, defaultSelected }) => {
    return Object.values(oasDocument.operations).reduce((acc, operation) => {
        const { path, method } = operation;
        acc[path] = acc[path] ?? {};
        acc[path][method] = operationsSettings?.[path]?.[method]
            ? operationsSettings?.[path]?.[method]
            : { selected: defaultSelected, enrichments: undefined };
        return acc;
    }, {});
};
