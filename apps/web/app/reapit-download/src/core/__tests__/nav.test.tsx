import { Nav, getDefaultNavIndex } from '../nav'
import { render } from '../../scripts/tests'

jest.mock('@reapit/connect-session', () => ({
  useReapitConnect: () => ({
    connectSession: {
      loginIdentity: {
        name: 'MOCK_NAME',
      },
    },
  }),
}))

jest.mock('../connect-session')

describe('Nav', () => {
  it('should match a snapshot', () => {
    window.location.pathname = '/'
    const wrapper = render(<Nav />)
    expect(wrapper).toMatchSnapshot()
  })
})

describe('getDefaultNavIndex', () => {
  const routes = [
    {
      route: '/contacts',
      index: 1,
    },
    {
      route: '/random-route',
      index: 0,
    },
  ]

  routes.forEach((route) => {
    it(`should correctly return the default nav index for ${route.route}`, () => {
      expect(getDefaultNavIndex(route.route)).toEqual(route.index)
    })
  })
})
