import { uniqueNamesGenerator, adjectives, animals, NumberDictionary } from 'unique-names-generator'

export const toNameSuggest = () => {
  const numbers = NumberDictionary.generate({ min: 100, max: 999 })

  const randomName: string = uniqueNamesGenerator({
    dictionaries: [adjectives, animals, numbers],
    separator: '-'
  })

  return randomName
}
