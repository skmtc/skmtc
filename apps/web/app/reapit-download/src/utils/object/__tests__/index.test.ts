import { nonNullableObject } from '../index'

describe('nonNullableObject', () => {
  it('should return an empty object if input is undefined', () => {
    const input: undefined = undefined
    const expectedOutput: any = {}
    const output = nonNullableObject(input)
    expect(output).toEqual(expectedOutput)
  })

  it('should return an object with non-null properties', () => {
    const input = { name: 'John', age: null, address: { city: 'New York', state: 'NY' } }
    const expectedOutput = { name: 'John', address: { city: 'New York', state: 'NY' } }
    const output = nonNullableObject<typeof input, typeof expectedOutput>(input)
    expect(output).toEqual(expectedOutput)
  })

  it('should return the same object if all properties are non-null', () => {
    const input = { name: 'John', age: 30, address: { city: 'New York', state: 'NY' } }
    const expectedOutput = { name: 'John', age: 30, address: { city: 'New York', state: 'NY' } }
    const output = nonNullableObject<typeof input, typeof expectedOutput>(input)
    expect(output).toEqual(expectedOutput)
  })
})
