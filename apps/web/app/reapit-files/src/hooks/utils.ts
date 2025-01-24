import { ReapitConnectBrowserSession } from '@reapit/connect-session'
import { AxiosError } from 'axios'
import qs from 'qs'

export const RC_SESSION_MISSING_ERROR =
  'Missing valid Reapit Connect Session, please try logging in again if the problem persists'
export const NETWORK_ERROR = 'ERR_NETWORK'

export interface StringMap {
  [key: string]: string
}

export interface ReapitErrorField {
  field?: string
  message?: string
}

export interface ReapitError {
  statusCode?: number
  errors?: ReapitErrorField[]
  description?: string
  dateTime?: string
  message?: string
  title?: string
}

export const getMergedHeaders = async (
  reapitConnectBrowserSession: ReapitConnectBrowserSession,
  headers?: StringMap,
): Promise<StringMap | null> => {
  const connectSession = await reapitConnectBrowserSession.connectSession()
  const accessToken = connectSession?.accessToken

  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
        'api-version': 'latest',
        'Content-Type': 'application/json',
        ...headers,
      }
    : null
}

export const handleReapitError = (error: AxiosError<any>, defaultMessage?: string): string => {
  const reapitError: ReapitError = error?.response?.data
  const { description, title, message, errors } = reapitError ?? {}
  const messageString = description
    ? description
    : title
      ? title
      : message
        ? message
        : error?.message
          ? error.message
          : defaultMessage
            ? defaultMessage
            : 'An unknown error has occurred, please refresh the page and try again.'
  const fieldErrors = Array.isArray(errors) ? errors?.map(({ field, message }) => `"${field}: ${message}"`) : null
  const fieldString = fieldErrors ? fieldErrors.join(', ') : ''

  return `${messageString} ${fieldString}`
}

export const stringListToBatchQuery = (list: (string | number)[], queryKey: string): string =>
  list.reduce((query: string, nextItem: string | number, index: number) => {
    if (!index) {
      return String(nextItem)
    }
    return `${query}&${queryKey}=${nextItem}`
  }, '')

// Where you have an object of filters with a mixture of arrays and strings / boolean / numeric values and
// you need a string map returned for useReapitGet
export const objectToQuery = <QueryObjectType extends {}>(queryObject: QueryObjectType): StringMap =>
  Object.keys(queryObject).reduce((currentQuery: StringMap, nextItem: string) => {
    const objectItem = queryObject[nextItem]

    if (Array.isArray(objectItem)) {
      currentQuery[nextItem] = stringListToBatchQuery(objectItem, nextItem)
    } else if (objectItem) {
      currentQuery[nextItem] = String(objectItem)
    }

    return currentQuery
  }, {} as StringMap)

export const getUrl = (path: string, queryParams?: Object) => (): string => {
  const api = process.env.PLATFORM_API_URL
  const normalisedQuery = objectToQuery(queryParams ?? {})
  const query = qs.stringify(normalisedQuery, { encode: false })
  const url = `${api}${path}${query ? `?${query}` : ''}`
  return url
}
