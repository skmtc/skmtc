export const toPathParams = (path: string): string => {
  return `${path.replaceAll(/{([^}]*)}/g, ':$1')}`
}
