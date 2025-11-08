export const isHttp = (string: string | undefined): boolean => {
  return Boolean(string?.startsWith('http://') || string?.startsWith('https://'))
}
