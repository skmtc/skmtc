/**
 * Checks whether a record/object is empty (has no enumerable properties).
 */
export const isEmpty = (value: object): boolean => {
  return !Object.keys(value).length
}
