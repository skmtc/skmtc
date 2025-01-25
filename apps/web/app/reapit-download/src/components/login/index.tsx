import { FC } from 'react'
import { Button, ButtonGroup, Subtitle, FlexContainer, Icon, elMb7, BodyText } from '@reapit/elements'
import { LoginContainer, LoginContentWrapper } from './__styles__'
import { reapitConnectBrowserSession } from '../../core/connect-session'

export const handleLoginClick = () => {
  reapitConnectBrowserSession.connectLoginRedirect()
}

export const LoginModule: FC = () => {
  return (
    <LoginContainer>
      <LoginContentWrapper>
        <Icon className={elMb7} height="40px" width="200px" icon="reapitLogo" />
        <FlexContainer isFlexColumn>
          <Subtitle hasCenteredText>Welcome</Subtitle>
          <BodyText hasCenteredText>Foundations App</BodyText>
        </FlexContainer>
        <ButtonGroup alignment="center">
          <Button onClick={handleLoginClick} intent="primary" size={3}>
            Login With Reapit
          </Button>
        </ButtonGroup>
      </LoginContentWrapper>
    </LoginContainer>
  )
}

export default LoginModule
export * from './login-routes'
