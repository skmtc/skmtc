import { NavigateFunction } from 'react-router-dom'

export const openNewPage = (uri: string) => () => {
  window.open(uri, '_blank')
}

export const navigateRoute = (navigateFn: NavigateFunction, route: string) => (): void => {
  navigateFn(route)
}
