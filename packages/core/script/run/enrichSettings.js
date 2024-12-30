"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichSettings = void 0;
const lodash_es_1 = require("lodash-es");
const enrichSettings = ({ generatorSettings, enrichments }) => {
    Object.values(generatorSettings).forEach(setting => {
        Object.values(enrichments[setting.id] ?? {}).forEach(({ key, value }) => {
            (0, lodash_es_1.set)(setting, key, value);
        });
    });
    return generatorSettings;
};
exports.enrichSettings = enrichSettings;
