import { OasDiscriminator } from './Discriminator.js';
export const toDiscriminatorV3 = ({ discriminator, context }) => {
    if (!discriminator) {
        return undefined;
    }
    const { propertyName, ...skipped } = discriminator;
    context.logSkippedFields(skipped);
    const fields = {
        propertyName
    };
    return new OasDiscriminator(fields);
};
