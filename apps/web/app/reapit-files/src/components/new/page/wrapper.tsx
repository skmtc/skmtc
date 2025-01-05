import { FC } from 'react'
import { FlexContainer, PageHeader, TextBase, Tile } from '@reapit/elements'
import { ErrorBoundary } from '../../../utils/error-boundary'

export const Wrapper: FC = () => {
  return (
    <ErrorBoundary>
      <PageHeader
        hasMaxWidth
        pageTitle={{
          children: 'New Page',
          hasBoldText: true,
        }}
        pageSubtitle={{
          children: 'This is a new page - add your content here',
        }}
      />
      <FlexContainer hasMaxWidth isFlexColumn>
        <Tile>
          <TextBase>Some body content here</TextBase>
        </Tile>
      </FlexContainer>
    </ErrorBoundary>
  )
}

export default Wrapper
