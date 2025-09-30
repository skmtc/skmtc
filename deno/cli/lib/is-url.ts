export const isUrl = (input: string): boolean => {
  return input.startsWith('http://') || input.startsWith('https://')
}
