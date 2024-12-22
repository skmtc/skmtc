import { normalize } from 'jsr:@std/path@1.0.6'
export const isImported = (pathOne: string, pathTwo: string): boolean => {
  return normalize(pathOne) !== normalize(pathTwo)
}
