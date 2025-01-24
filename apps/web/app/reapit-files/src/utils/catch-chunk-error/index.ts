import { ComponentType } from 'react'

export const catchChunkError = (
  fn: Function,
  retriesLeft = 3,
  interval = 500,
): Promise<{ default: ComponentType<any> }> => {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error: Error) => {
        console.info(error)
        setTimeout(() => {
          if (retriesLeft === 1) {
            window.location.reload()
            return
          }
          catchChunkError(fn, retriesLeft - 1, interval).then(resolve, reject)
        }, interval)
      })
  })
}
