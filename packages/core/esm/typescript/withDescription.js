export const withDescription = (value, { description }) => {
    return description ? `/** ${description} */\n${value}` : `${value}`;
};
