import { set } from 'lodash-es';
export const enrichSettings = ({ generatorSettings, enrichments }) => {
    Object.values(generatorSettings).forEach(setting => {
        Object.values(enrichments[setting.id] ?? {}).forEach(({ key, value }) => {
            set(setting, key, value);
        });
    });
    return generatorSettings;
};
