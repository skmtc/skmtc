import React, { PropsWithChildren } from 'react'
import { renderHook, act } from '@testing-library/react'
import { usePlatformUpdate } from '../use-platform-update'
import { ReapitUpdateState } from '../use-platform-update'
import axios from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

jest.mock('axios', () => ({
  __esModule: true,
  default: jest.fn(),
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
const mockAxios = axios as unknown as jest.Mock

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

describe('usePlatformUpdate', () => {
  it('should correctly set loading, send data without data update', async () => {
    const objectBody = {
      test: true,
    }

    const { result } = renderHook<{}, ReapitUpdateState<{}, typeof mockData>>(
      () =>
        usePlatformUpdate<{}, typeof mockData>({
          path: '/foo/bar',
          headers: {
            foo: 'bar',
          },
          successMessage: 'Success',
          errorMessage: 'Error',
        }),
      {
        wrapper: createWrapper(),
      },
    )
    expect(result.current[0]).toBeInstanceOf(Function)
    expect(result.current[1]).toBeFalsy()
    expect(result.current[2]).toBeNull()
    expect(result.current[3]).toBeFalsy()
    expect(result.current[4]).toBeFalsy()

    act(() => {
      result.current[0](objectBody)
    })

    await new Promise((resolve) => setTimeout(resolve, 1))

    expect(mockAxios).toHaveBeenCalledWith('https://platform.reapit.cloud/foo/bar', {
      data: { test: true },
      headers: {
        Authorization: 'Bearer MOCK_ACCESS_TOKEN',
        'Content-Type': 'application/json',
        'api-version': 'latest',
        foo: 'bar',
      },
      method: 'POST',
    })
    expect(mockAxios).toHaveBeenCalledTimes(1)
    expect(mockError).not.toHaveBeenCalled()

    expect(result.current[1]).toEqual(false)
    expect(result.current[2]).toEqual(true)
    expect(result.current[3]).toEqual(true)
    expect(mockSuccess).toHaveBeenCalledWith('Success')

    expect(mockAxios).toHaveBeenCalledTimes(1)
  })

  it('should correctly set loading, send data with data update', async () => {
    const objectBody = {
      test: true,
    }

    const headers = new Headers()
    headers.append('Location', 'https://api.test.reapit.com/path')

    mockAxios.mockReturnValue({
      headers,
      data: { updated: true },
    })

    const { result } = renderHook<{}, ReapitUpdateState<{}, typeof mockData>>(
      () =>
        usePlatformUpdate<{}, typeof mockData>({
          path: '/foo/bar',
          headers: {
            foo: 'bar',
          },
          successMessage: 'Success',
          errorMessage: 'Error',
          shouldReturnRecord: true,
        }),
      {
        wrapper: createWrapper(),
      },
    )

    expect(result.current[0]).toBeInstanceOf(Function)
    expect(result.current[1]).toBeFalsy()
    expect(result.current[2]).toBeNull()
    expect(result.current[3]).toBeFalsy()
    expect(result.current[4]).toBeFalsy()

    act(() => {
      result.current[0](objectBody)
    })

    await new Promise((resolve) => setTimeout(resolve, 1))

    expect(mockAxios).toHaveBeenCalledTimes(2)

    expect(mockAxios).toHaveBeenCalledWith('https://platform.reapit.cloud/foo/bar', {
      data: { test: true },
      headers: {
        Authorization: 'Bearer MOCK_ACCESS_TOKEN',
        'Content-Type': 'application/json',
        'api-version': 'latest',
        foo: 'bar',
      },
      method: 'POST',
    })

    expect(mockAxios).toHaveBeenLastCalledWith('https://api.test.reapit.com/path', {
      headers: {
        Authorization: 'Bearer MOCK_ACCESS_TOKEN',
        'Content-Type': 'application/json',
        'api-version': 'latest',
        foo: 'bar',
      },
      method: 'GET',
    })

    expect(mockError).not.toHaveBeenCalled()

    expect(result.current[1]).toEqual(false)
    expect(result.current[2]).toEqual({ updated: true })
    expect(result.current[3]).toEqual(true)
    expect(mockSuccess).toHaveBeenCalledWith('Success')

    expect(mockAxios).toHaveBeenCalledTimes(2)
  })

  it('should correctly handle an error', async () => {
    mockAxios.mockImplementation(
      jest.fn(() => {
        return Promise.reject('Error')
      }),
    )
    const objectBody = {
      test: true,
    }

    const { result } = renderHook<{}, ReapitUpdateState<{}, typeof mockData>>(
      () =>
        usePlatformUpdate<{}, typeof mockData>({
          path: '/foo/bar',
          headers: {
            foo: 'bar',
          },
          successMessage: 'Success',
          errorMessage: 'Error',
        }),
      {
        wrapper: createWrapper(),
      },
    )
    expect(result.current[0]).toBeInstanceOf(Function)
    expect(result.current[1]).toBeFalsy()
    expect(result.current[2]).toBeNull()
    expect(result.current[3]).toBeFalsy()
    expect(result.current[4]).toBeFalsy()

    try {
      await result.current[0](objectBody)

      await new Promise((resolve) => setTimeout(resolve, 2))

      expect(mockAxios).toHaveBeenCalledWith('https://platform.reapit.cloud/foo/bar', {
        data: { test: true },
        headers: {
          Authorization: 'Bearer MOCK_ACCESS_TOKEN',
          'Content-Type': 'application/json',
          'api-version': 'latest',
          foo: 'bar',
        },
        method: 'POST',
      })

      expect(mockAxios).toHaveBeenCalledTimes(1)
      expect(mockError).toHaveBeenCalledWith('Error')

      expect(result.current[1]).toEqual(false)
      expect(result.current[2]).toBeNull()
      expect(result.current[3]).toEqual(false)

      expect(mockAxios).toHaveBeenCalledTimes(1)
    } catch (error) {
      console.log(error)
    }
  })

  afterEach(() => {
    mockAxios.mockClear()
  })
})
