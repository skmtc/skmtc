import { combineName } from '../index'

describe('combineName', () => {
  it('should correctly combine name', () => {
    const result = combineName('Mr', 'John', 'Smith')
    const expected = 'Mr John Smith'
    expect(result).toEqual(expected)
  })

  it('should correctly combine name if a value is missing', () => {
    const result = combineName('Mr', undefined, 'Smith')
    const expected = 'Mr Smith'
    expect(result).toEqual(expected)
  })
})
