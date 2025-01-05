import { NavigateFunction } from 'react-router'

export const openNewPage = (uri: string) => () => {
  window.open(uri, '_blank')
}

export const navigateRoute = (navigateFn: NavigateFunction, route: string) => (): void => {
  navigateFn(route)
}
