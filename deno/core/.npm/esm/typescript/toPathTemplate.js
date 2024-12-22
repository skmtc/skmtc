export const toPathTemplate = (path, queryArg) => {
    return `${path.replaceAll(/{([^}]*)}/g, queryArg ? '${' + queryArg + '.$1}' : '${$1}')}`;
};
