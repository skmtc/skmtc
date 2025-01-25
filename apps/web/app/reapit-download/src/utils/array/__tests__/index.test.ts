import { uniqueArray } from '../index'

describe('uniqueArray', () => {
  it('should return a new array with unique values', () => {
    const input = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
      { id: 1, name: 'John' },
    ]
    const expectedOutput = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
    ]
    const output = uniqueArray(input)
    expect(output).toEqual(expectedOutput)
  })

  it('should return an empty array if input is empty', () => {
    const input: any[] = []
    const expectedOutput: any[] = []
    const output = uniqueArray(input)
    expect(output).toEqual(expectedOutput)
  })
})
