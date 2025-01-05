export const specialCharsTest = {
  name: 'hasNoSpecialChars',
  message: 'Special characters are not permitted',
  test: (value?: string | null) => {
    if (!value) return true

    if (/^[\w\-\s£$@%&*()?!%/=+'"~^,.#;:]+$/.test(value) && /^((?!javascript).)*$/.test(value.toLowerCase())) {
      return true
    }

    return false
  },
}
