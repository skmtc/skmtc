export const scrubSelector = (selector: string) => {
  return selector
    .replaceAll('@', '')
    .replaceAll('/', '-')
    .replaceAll(':', '-')
    .replaceAll(' ', '')
    .replaceAll('{', '')
    .replaceAll('}', '');
};
