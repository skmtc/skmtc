import { NavResponsive } from '@reapit/elements'

export const TopNav = () => {
  return (
    <NavResponsive
      defaultNavIndex={1}
      appSwitcherOptions={[
        {
          text: 'AppMarket',
          callback: () => console.log('Navigating')
        },
        {
          text: 'DevPortal',
          callback: () => console.log('Navigating')
        }
      ]}
      options={[
        {
          itemIndex: 0,
          callback: () => console.log('Navigating')
        },
        {
          itemIndex: 1,
          callback: () => console.log('Navigating'),
          text: 'Apps',
          subItems: [
            {
              itemIndex: 0,
              callback: () => console.log('Navigating'),
              text: 'App List'
            },
            {
              itemIndex: 1,
              callback: () => console.log('Navigating'),
              text: 'Create App'
            }
          ]
        },
        {
          itemIndex: 2,
          callback: () => console.log('Navigating'),
          text: 'Analytics',
          subItems: [
            {
              itemIndex: 2,
              callback: () => console.log('Navigating'),
              text: 'Hits Per Day'
            },
            {
              itemIndex: 3,
              callback: () => console.log('Navigating'),
              text: 'Weekly Hits'
            }
          ]
        }
      ]}
    />
  )
}
