import { BodyText, FormLayout, elFadeIn } from '@reapit/elements'
import { ReactNode } from 'react'

type WorkflowStepProps = {
  title: string
  children: ReactNode
}

export const WorkflowStep = ({ title, children }: WorkflowStepProps) => (
  <>
    <BodyText hasBoldText hasSectionMargin>
      {title}
    </BodyText>
    <FormLayout className={elFadeIn}>{children}</FormLayout>
  </>
)
