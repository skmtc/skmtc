import { navigateRoute, openNewPage } from '..'

describe('navigate', () => {
  it('should open a new page', () => {
    const navigateFn = jest.fn()

    const curried = navigateRoute(navigateFn, '/home')

    curried()

    expect(navigateFn).toHaveBeenCalledWith('/home')
  })
})

describe('openNewPage', () => {
  it('should open a new page', () => {
    const windowSpy = ((window.open as any) = jest.fn())
    const curried = openNewPage('/home')

    curried()

    expect(windowSpy).toHaveBeenCalledWith('/home', '_blank')
  })
})
