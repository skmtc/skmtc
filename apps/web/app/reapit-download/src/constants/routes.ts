import { LOGIN_ROUTES } from '../components/login'
import { NEW_ROUTES } from '../components/new'

export const Routes = {
  HOME: '/',
  ...LOGIN_ROUTES,
  ...NEW_ROUTES,
}
