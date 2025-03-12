type QuerySerialiserOptions = {
  style: 'form'
  explode: true
}

type QuerySerialiserArgs = {
  args: Record<string, unknown>
  options: QuerySerialiserOptions
}

export const defaultQuerySerialiserOptions: QuerySerialiserOptions = {
  style: 'form',
  explode: true
}

export const querySerialiser = ({ args }: QuerySerialiserArgs) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const queryString = Object.entries(args)
    .filter(([_key, value]) => {
      return value !== undefined && value !== null && value !== ''
    })
    .map(([key, value]) => {
      return Array.isArray(value) ? value.map(v => `${key}=${v}`).join('&') : `${key}=${value}`
    })
    .join('&')

  return queryString ? `?${queryString}` : ''
}
