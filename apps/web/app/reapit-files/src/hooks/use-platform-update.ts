import { useMemo } from 'react'
import { useSnack } from '@reapit/elements'
import {
  getMergedHeaders,
  getUrl,
  handleReapitError,
  NETWORK_ERROR,
  RC_SESSION_MISSING_ERROR,
  StringMap,
} from './utils'
import { useMutation } from '@tanstack/react-query'
import axios, { AxiosError, AxiosResponseHeaders } from 'axios'
import { useNavigate } from 'react-router'
import { reapitConnectBrowserSession } from '../core/connect-session'

export type ReapitUpdateState<ParamsType, DataType> = [
  UpdateFunction<ParamsType, DataType>,
  boolean,
  DataType | null,
  boolean,
  boolean,
]

type AcceptedMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GET'

export interface ReapitUpdate {
  path: string
  method?: AcceptedMethod
  shouldReturnRecord?: boolean
  headers?: StringMap
  errorMessage?: string
  successMessage?: string
}

export type UpdateFunction<ParamsType, DataType> = (params: ParamsType) => Promise<DataType>

export const usePlatformUpdate = <ParamsType, DataType>({
  path,
  method = 'POST',
  shouldReturnRecord = false,
  headers = {},
  errorMessage,
  successMessage,
}: ReapitUpdate): ReapitUpdateState<ParamsType, DataType> => {
  const { error: errorSnack, success: successSnack } = useSnack()
  const navigate = useNavigate()
  const url = useMemo(getUrl(path), [path])

  const { mutateAsync, data, isSuccess, isError, isPending } = useMutation<DataType, AxiosError<any>, ParamsType>({
    mutationKey: [url],
    mutationFn: async (data: ParamsType) => {
      const updateHeaders = await getMergedHeaders(reapitConnectBrowserSession, headers)

      if (!updateHeaders) throw new Error(RC_SESSION_MISSING_ERROR)

      const res = await axios<DataType>(url, {
        method,
        headers: updateHeaders,
        data,
      })

      if (!shouldReturnRecord) return true

      const resHeaders = res.headers as AxiosResponseHeaders
      const location = resHeaders.get('Location')?.valueOf() as string

      if (!location) throw new Error('Location was not returned by server')

      const locationUrl = location.includes('.prod.paas') ? location.replace('.prod.paas', '') : location

      const locationRes = await axios(locationUrl, {
        method: 'GET',
        headers: updateHeaders,
      })

      return locationRes.data
    },
    onSuccess: () => {
      if (successMessage) successSnack(successMessage)
    },
    onError: (error: AxiosError<any>) => {
      const isRcError = error?.message === RC_SESSION_MISSING_ERROR
      const isFourOOne = error.code === NETWORK_ERROR

      if (isRcError || isFourOOne) {
        return navigate('/login')
      }

      const errorString = !isRcError ? handleReapitError(error, errorMessage) : null
      if (errorString) errorSnack(errorString, 5000)
      console.error(errorString)
    },
  })

  const updateFunction: UpdateFunction<ParamsType, DataType> = (data: ParamsType) => mutateAsync(data)
  const returnData = data ?? null

  return [updateFunction, isPending, returnData, isSuccess, isError]
}
