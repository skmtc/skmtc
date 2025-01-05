import { CONTACTS_ROUTES } from '../components/contacts'
import { LOGIN_ROUTES } from '../components/login'
import { NEW_ROUTES } from '../components/new'

export const Routes = {
  HOME: '/',
  ...LOGIN_ROUTES,
  ...CONTACTS_ROUTES,
  ...NEW_ROUTES,
}
