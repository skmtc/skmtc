import { specialCharsTest } from '..'

describe('specialCharsTest object', () => {
  it('should return true for a string with no special characters', () => {
    const value = 'Hello World'
    const result = specialCharsTest.test(value)
    expect(result).toBe(true)
  })

  it('should return false for a string with special characters', () => {
    const value = 'Hello, World <>'
    const result = specialCharsTest.test(value)
    expect(result).toBe(false)
  })

  it('should return true for a null value', () => {
    const value = null
    const result = specialCharsTest.test(value)
    expect(result).toBe(true)
  })

  it('should return true for an undefined value', () => {
    const value = undefined
    const result = specialCharsTest.test(value)
    expect(result).toBe(true)
  })

  it("should return false for a string with 'javascript' in it", () => {
    const value = 'Hello javascript World'
    const result = specialCharsTest.test(value)
    expect(result).toBe(false)
  })

  it("should return false for a string with a special character and 'javascript' in it", () => {
    const value = 'Hello, javascript World!'
    const result = specialCharsTest.test(value)
    expect(result).toBe(false)
  })
})
