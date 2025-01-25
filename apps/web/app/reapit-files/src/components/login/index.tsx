import { FC } from 'react'
import { Subtitle, FlexContainer, Icon, elMb7, BodyText } from '@reapit/elements'
import { LoginContainer, LoginContentWrapper } from './__styles__'

export const LoginModule: FC = () => {
  return (
    <LoginContainer>
      <LoginContentWrapper>
        <Icon className={elMb7} height="40px" width="200px" icon="reapitLogo" />
        <FlexContainer isFlexColumn>
          <Subtitle hasCenteredText>Welcome</Subtitle>
          <BodyText hasCenteredText>Foundations App</BodyText>
        </FlexContainer>
      </LoginContentWrapper>
    </LoginContainer>
  )
}

export default LoginModule
export * from './login-routes'
