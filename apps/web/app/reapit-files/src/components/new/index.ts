/* istanbul ignore file */
import { lazy } from 'react'
import { catchChunkError } from '../../utils/catch-chunk-error'

export const NewModule = lazy(() => catchChunkError(() => import('./page')))
export * from './routes'
