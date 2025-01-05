/* istanbul ignore file */
import { lazy } from 'react'
import { catchChunkError } from '../../utils/catch-chunk-error'

export const ContactsModule = lazy(() => catchChunkError(() => import('./page')))
export * from './routes'
