import "../_dnt.polyfills.js";
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const decapitalize = (str: string): string => {
  return str.charAt(0).toLocaleLowerCase() + str.slice(1)
}

type CamelCaseOptions = {
  upperFirst?: boolean
}

export const camelCase = (str: string, { upperFirst }: CamelCaseOptions = {}): string => {
  let doCapitalize = Boolean(upperFirst)

  const camelCased = str.replace(/[^a-zA-Z0-9]+([a-zA-Z0-9]+)/g, (_, matched) => {
    if (doCapitalize) {
      return capitalize(matched)
    }

    doCapitalize = true

    return matched
  })

  const cleaned = camelCased.replaceAll(/[^a-z0-9]*/gi, '')

  return upperFirst ? capitalize(cleaned) : cleaned
}
