import { useEffect, useMemo } from 'react'
import {
  StringMap,
  getMergedHeaders,
  handleReapitError,
  getUrl,
  RC_SESSION_MISSING_ERROR,
  NETWORK_ERROR,
} from './utils'
import { useSnack } from '@reapit/elements'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios, { AxiosError } from 'axios'
import { NavigateFunction, useNavigate } from 'react-router'
import { reapitConnectBrowserSession } from '../core/connect-session'

export type PlatformGet<DataType> = [
  data: DataType | null,
  loading: boolean,
  error: string | null,
  refresh: (queryParams?: Object) => void,
  refreshing: boolean,
  clearCache: () => void,
]

export interface UsePlatformGetParams {
  path: string
  errorMessage?: string
  successMessage?: string
  queryParams?: Object
  headers?: StringMap
  fetchWhenTrue?: any[]
  retry?: number | boolean
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export const handleError =
  (
    isError: boolean,
    error: AxiosError<any, any> | null,
    errorSnack: (text: string, timeout?: number | undefined) => void,
    navigate: NavigateFunction,
    errorMessage?: string,
    onError?: (message: string) => void,
  ) =>
  () => {
    if (isError && error) {
      const isRcError = error.message === RC_SESSION_MISSING_ERROR
      const isFourOOne = error.code === NETWORK_ERROR
      if (isRcError || isFourOOne) {
        return navigate('/login')
      }

      const errorString = handleReapitError(error, errorMessage)
      if (onError && errorString) onError(errorString)
      if (!onError && errorString) errorSnack(errorString)
      console.error(errorString)
    }
  }

export const handleSuccess =
  (
    isSuccess: boolean,
    successSnack: (text: string, timeout?: number | undefined) => void,
    successMessage?: string,
    onSuccess?: (message: string) => void,
  ) =>
  () => {
    if (isSuccess) {
      if (onSuccess && successMessage) onSuccess(successMessage)
      if (!onSuccess && successMessage) successSnack(successMessage)
    }
  }

export const usePlatformGet = <DataType>({
  path,
  errorMessage,
  successMessage,
  queryParams,
  headers,
  fetchWhenTrue,
  onSuccess,
  onError,
  retry,
}: UsePlatformGetParams): PlatformGet<DataType> => {
  const { success: successSnack, error: errorSnack } = useSnack()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isEnabled = fetchWhenTrue?.length
    ? Boolean(fetchWhenTrue?.filter(Boolean).length === fetchWhenTrue.length)
    : true

  const url = useMemo(getUrl(path, queryParams), [path, queryParams])

  const { data, error, isLoading, isSuccess, isError, isRefetching, refetch } = useQuery<DataType, AxiosError<any>>({
    queryKey: [url],
    queryFn: async () => {
      const reqHeaders = await getMergedHeaders(reapitConnectBrowserSession, headers)

      if (!reqHeaders) throw new Error(RC_SESSION_MISSING_ERROR)

      const req = await axios.get<DataType>(url, {
        headers: reqHeaders,
      })
      return req.data
    },
    retry: retry === undefined ? 1 : retry,
    refetchOnWindowFocus: false,
    enabled: isEnabled,
  })

  useEffect(handleSuccess(isSuccess, successSnack, successMessage, onSuccess), [
    isSuccess,
    successMessage,
    onSuccess,
    successSnack,
  ])

  useEffect(handleError(isError, error, errorSnack, navigate, errorMessage, onError), [
    isError,
    error,
    errorMessage,
    onError,
    errorSnack,
    navigate,
  ])

  const result = data ? data : null
  const errorString = error?.message ? error.message : null
  const loading = isEnabled && isLoading
  const clearCache = () => {
    queryClient.removeQueries({ queryKey: [url] })
  }

  return [result, loading, errorString, refetch, isRefetching, clearCache]
}
