import { normalize } from '@std/path/normalize'
export const isImported = (pathOne: string, pathTwo: string): boolean => {
  return normalize(pathOne) !== normalize(pathTwo)
}
