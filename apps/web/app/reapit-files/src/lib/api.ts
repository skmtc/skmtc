// import { reapitConnectBrowserSession } from '@/lib/connectSession'

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

export const RC_SESSION_MISSING_ERROR =
  'Missing valid Reapit Connect Session, please try logging in again if the problem persists'
export const NETWORK_ERROR = 'ERR_NETWORK'

export const handleReapitError = (error: ReapitError, defaultMessage?: string): string => {
  const { description, title, message, errors } = error ?? {}
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
  const fieldErrors = Array.isArray(errors)
    ? errors?.map(({ field, message }) => `"${field}: ${message}"`)
    : null
  const fieldString = fieldErrors ? fieldErrors.join(', ') : ''

  return `${messageString} ${fieldString}`
}

export const getMergedHeaders = async (
  headers?: Record<string, string | undefined>
): Promise<HeadersInit | undefined> => {
  // const connectSession = await reapitConnectBrowserSession.connectSession()
  // const accessToken = connectSession?.accessToken

  const accessToken = import.meta.env.VITE_AUTH_TOKEN

  console.log('ACCESS TOKEN', accessToken)

  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
        'api-version': 'latest',
        'Content-Type': 'application/json',
        ...Object.fromEntries(Object.entries(headers ?? {}).filter(([, value]) => value))
      }
    : undefined
}
