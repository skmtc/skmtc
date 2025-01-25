import { catchChunkError } from '..'

describe('catchChunkError', () => {
  it('should resolve with a default React component when function succeeds', async () => {
    const mockFn = jest.fn().mockResolvedValueOnce({ default: () => <div>Success!</div> })
    const result = await catchChunkError(mockFn)
    expect(result).toEqual({ default: expect.any(Function) })
  })
})
