export const combineName = (title?: string, forename?: string, surname?: string): string => {
  let nameCombined = ''

  if (title) {
    nameCombined = nameCombined.concat(`${title}`)
  }

  if (forename) {
    nameCombined = nameCombined.concat(` ${forename}`)
  }

  if (surname) {
    nameCombined = nameCombined.concat(` ${surname}`)
  }

  if (!nameCombined) return 'Unknown'

  return nameCombined
}
