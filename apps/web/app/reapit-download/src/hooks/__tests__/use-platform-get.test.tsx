import { PropsWithChildren } from 'react'
import { renderHook } from '@testing-library/react'
import axios, { AxiosError } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlatformGet, handleError, handleSuccess, usePlatformGet } from '../use-platform-get'
import { MemoryRouter } from 'react-router'
import { RC_SESSION_MISSING_ERROR } from '../utils'

jest.mock('axios', () => ({
  get: jest.fn(),
}))

jest.mock('@reapit/elements', () => ({
  useSnack: jest.fn(() => ({
    success: mockSuccess,
    error: mockError,
  })),
}))

jest.mock('../../core/connect-session')

const mockData = {
  someData: {
    someKey: 'someValue',
  },
}
const mockSuccess = jest.fn()
const mockError = jest.fn()
const mockAxios = axios.get as unknown as jest.Mock

process.env.PLATFORM_API_URL = 'https://platform.reapit.cloud'

const createWrapper = () => {
  const queryClient = new QueryClient()
  const Wrapper: PropsWithChildren<any> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )

  return Wrapper
}

describe('usePlatformGet', () => {
  it('should correctly set loading, fetch data, render a success message and refresh', async () => {
    mockAxios.mockReturnValue({
      data: mockData,
    })

    const { result } = renderHook<{}, PlatformGet<typeof mockData>>(
      () =>
        usePlatformGet<typeof mockData>({
          path: '/foo/bar',
          headers: {
            foo: 'bar',
          },
          queryParams: {
            baz: 'bat',
          },
          successMessage: 'Success',
          errorMessage: 'Error',
          fetchWhenTrue: [true],
        }),
      {
        wrapper: createWrapper(),
      },
    )
    expect(result.current[0]).toBeNull()
    expect(result.current[1]).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 1))

    expect(mockAxios).toHaveBeenCalledWith('https://platform.reapit.cloud/foo/bar?baz=bat', {
      headers: {
        Authorization: 'Bearer MOCK_ACCESS_TOKEN',
        'Content-Type': 'application/json',
        'api-version': 'latest',
        foo: 'bar',
      },
    })

    expect(mockAxios).toHaveBeenCalledTimes(1)

    await new Promise((resolve) => setTimeout(resolve, 1))

    expect(mockSuccess).toHaveBeenCalledWith('Success')
    expect(mockError).not.toHaveBeenCalled()

    expect(result.current[0]).toEqual(mockData)
    expect(result.current[1]).toEqual(false)
    expect(result.current[2]).toEqual(null)

    const refresh = result.current[3]

    refresh()

    await new Promise((resolve) => setTimeout(resolve, 1))

    expect(mockAxios).toHaveBeenCalledTimes(2)
  })

  it('should correctly handle an error', async () => {
    mockAxios.mockImplementation(
      jest.fn(() => {
        throw new Error('Error')
      }),
    )

    const { result } = renderHook<{}, PlatformGet<typeof mockData>>(
      () =>
        usePlatformGet<typeof mockData>({
          path: '/foo/bar',
          headers: {
            foo: 'bar',
          },
          queryParams: {
            baz: 'bat',
          },
          successMessage: 'Success',
          errorMessage: 'Error',
          fetchWhenTrue: [true],
          retry: false,
        }),
      {
        wrapper: createWrapper(),
      },
    )
    expect(result.current[0]).toBeNull()
    expect(result.current[1]).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 2))

    expect(mockError).toHaveBeenCalled()

    expect(result.current[0]).toBeNull()
    expect(result.current[1]).toEqual(false)
    expect(result.current[2]).toEqual('Error')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })
})

describe('handleError', () => {
  it('should handle error correctly with the onError handler', () => {
    const isError = true
    const error = {
      message: 'RC_SESSION_MISSING_ERROR',
      code: 'NETWORK_ERROR',
      config: {},
      isAxiosError: true,
      toJSON: () => ({}),
    } as AxiosError
    const errorSnack = jest.fn()
    const navigate = jest.fn()
    const errorMessage = 'Test error message'
    const onError = jest.fn()

    const curried = handleError(isError, error, errorSnack, navigate, errorMessage, onError)

    curried()

    expect(navigate).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(`${error.message} `)
    expect(errorSnack).not.toHaveBeenCalled()
  })

  it('should handle error correctly with the errorSnack handler', () => {
    const isError = true
    const error = {
      message: 'RC_SESSION_MISSING_ERROR',
      code: 'NETWORK_ERROR',
      config: {},
      isAxiosError: true,
      toJSON: () => ({}),
    } as AxiosError
    const errorSnack = jest.fn()
    const navigate = jest.fn()
    const errorMessage = 'Test error message'
    const onError = jest.fn()

    const curried = handleError(isError, error, errorSnack, navigate, errorMessage)

    curried()

    expect(navigate).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(errorSnack).toHaveBeenCalledWith(`${error.message} `)
  })

  it('should handle error correctly when session is missing', () => {
    const isError = true
    const error = {
      message: RC_SESSION_MISSING_ERROR,
      code: 'NETWORK_ERROR',
      config: {},
      isAxiosError: true,
      toJSON: () => ({}),
    } as AxiosError
    const errorSnack = jest.fn()
    const navigate = jest.fn()
    const errorMessage = 'Test error message'
    const onError = jest.fn()

    const curried = handleError(isError, error, errorSnack, navigate, errorMessage, onError)

    curried()

    expect(navigate).toHaveBeenCalledWith('/login')
    expect(onError).not.toHaveBeenCalled()
    expect(errorSnack).not.toHaveBeenCalled()
  })
})

describe('handleSuccess', () => {
  it('should handle success correctly', () => {
    const isSuccess = true
    const successSnack = jest.fn()
    const successMessage = 'Test success message'
    const onSuccess = jest.fn()

    const curried = handleSuccess(isSuccess, successSnack, successMessage, onSuccess)

    curried()

    expect(onSuccess).toHaveBeenCalledWith(successMessage)
    expect(successSnack).not.toHaveBeenCalled()
  })

  it('should handle success correctly when onSuccess is not provided', () => {
    const isSuccess = true
    const successSnack = jest.fn()
    const successMessage = 'Test success message'

    const curried = handleSuccess(isSuccess, successSnack, successMessage)

    curried()

    expect(successSnack).toHaveBeenCalledWith(successMessage)
  })
})
