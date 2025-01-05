import { FC } from 'react'
import { useReapitConnect } from '@reapit/connect-session'
import { reapitConnectBrowserSession } from './connect-session'
import { Icon, NavResponsive, NavResponsiveOption } from '@reapit/elements'
import { Routes } from '../constants/routes'
import { useNavigate } from 'react-router'
import { navigateRoute, openNewPage } from '../utils/navigate'
import { getAvatarInitials } from '../utils/nav'

export const getDefaultNavIndex = (pathname: string) => {
  if (pathname.includes('contacts')) return 1
  if (pathname.includes('new-module')) return 2
  return 0
}

const { CONTACTS_LIST, CONTACTS_NEW } = Routes

export const Nav: FC = () => {
  const { connectLogoutRedirect, connectIsDesktop, connectSession } = useReapitConnect(reapitConnectBrowserSession)
  const navigate = useNavigate()

  const navOptions: NavResponsiveOption[] = [
    {
      itemIndex: 0,
    },
    {
      itemIndex: 1,
      text: 'Contacts',
      callback: navigateRoute(navigate, Routes.CONTACTS_LIST),
      subItems: [
        {
          itemIndex: 4,
          callback: navigateRoute(navigate, CONTACTS_LIST),
          text: 'List',
        },
        {
          itemIndex: 5,
          callback: navigateRoute(navigate, CONTACTS_NEW),
          text: 'New',
        },
      ],
    },
    {
      itemIndex: 2,
      text: 'New Page',
      callback: navigateRoute(navigate, Routes.NEW_HOME),
    },
  ]

  return (
    <NavResponsive
      options={navOptions}
      defaultNavIndex={getDefaultNavIndex(window.location.pathname)}
      appSwitcherOptions={[
        {
          text: 'AppMarket',
          callback: openNewPage('https://marketplace.reapit.cloud'),
          iconUrl: <Icon icon="reapitLogoSmall" />,
        },
        {
          text: 'DevPortal',
          callback: openNewPage('https://developers.reapit.cloud'),
          iconUrl: <Icon icon="reapitLogoSmall" />,
        },
      ]}
      avatarText={getAvatarInitials(connectSession)}
      avatarOptions={
        !connectIsDesktop
          ? [
              {
                callback: connectLogoutRedirect,
                text: 'Logout',
              },
            ]
          : undefined
      }
    />
  )
}

export default Nav
