export const toPathTemplate = (path: string, queryArg?: string): string => {
  return `${path.replaceAll(
    /{([^}]*)}/g,
    queryArg ? '${' + queryArg + '.$1}' : '${$1}'
  )}`
}
