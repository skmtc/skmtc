import { ComponentType, Dispatch, ReactNode, SetStateAction, useState } from 'react'
import {
  Button,
  ButtonGroup,
  elMb8,
  elMl8,
  FlexContainer,
  StepsVertical,
  Tile,
  useMediaQuery
} from '@reapit/elements'
import { cx } from '@linaria/core'
import { ErrorBoundary } from '@/utils/error-boundary'
import { WorkflowStep } from '@/components/WorkflowStep'
import { FieldValues, useFormContext, UseFormTrigger } from 'react-hook-form'
import { FieldParent, KeyPath, ModelConfig } from '@/components/ModelRuntimeConfig'
import { MouseEvent } from 'react'

type HandleSwitchStepArgs<Model extends FieldValues, Key extends KeyPath<Model>> = {
  selectedStep: number
  trigger: UseFormTrigger<Model>
  setSelectedStep: Dispatch<SetStateAction<number>>
  fieldsList: Key[][]
}

export const handleSwitchStep =
  <Model extends FieldValues, Key extends KeyPath<Model>>({
    selectedStep,
    trigger,
    setSelectedStep,
    fieldsList
  }: HandleSwitchStepArgs<Model, Key>) =>
  (event: MouseEvent) => {
    const validate = async () => {
      if (selectedStep < fieldsList.length - 1) {
        event.preventDefault()
      }

      let isValid = false

      for (let i = 0; i <= selectedStep; i++) {
        isValid = await trigger(fieldsList[i])

        if (!isValid) {
          return
        }
      }

      console.log(fieldsList.length, selectedStep)

      if (isValid) {
        setSelectedStep(Math.min(selectedStep + 1, fieldsList.length - 1))
      }
    }

    validate()
  }

type WorkflowSection<Model extends FieldValues, Key extends KeyPath<Model>> = {
  title: string
  fields: Key[]
}
type FormContainerProps<Model extends FieldValues> = {
  children: ReactNode
  defaultValues?: Model
}

export type CreateWorkflowProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  children: ReactNode
  sections: WorkflowSection<Model, Key>[]
  fieldConfig: ModelConfig<Model>
  FormContainer: ComponentType<FormContainerProps<Model>>
}

export const CreateWorkflow = <Model extends FieldValues, Key extends KeyPath<Model>>({
  children,
  sections,
  fieldConfig,
  FormContainer
}: CreateWorkflowProps<Model, Key>) => {
  const [selectedStep, setSelectedStep] = useState(0)

  return (
    <ErrorBoundary>
      {children}
      <FlexContainer isFlexColumn hasMaxWidth>
        <Tile>
          <FormContainer>
            <StepsVertical
              steps={sections.map(({ title, fields }, index) => ({
                item: `${index + 1}`,
                content: (
                  <WorkflowStep title={title}>
                    <CreateFields fieldNames={fields} fieldConfig={fieldConfig} />
                  </WorkflowStep>
                )
              }))}
              selectedStep={`${selectedStep + 1}`}
              onStepClick={stringStep => setSelectedStep(parseInt(stringStep) - 1)}
            />
            <Buttons
              selectedStep={selectedStep}
              setSelectedStep={setSelectedStep}
              fieldsList={sections.map(({ fields }) => fields)}
            />
          </FormContainer>
        </Tile>
      </FlexContainer>
    </ErrorBoundary>
  )
}

type ButtonsProps<Model extends FieldValues, Key extends KeyPath<Model>> = {
  selectedStep: number
  setSelectedStep: Dispatch<SetStateAction<number>>
  fieldsList: Key[][]
}

const Buttons = <Model extends FieldValues, Key extends KeyPath<Model>>({
  selectedStep,
  setSelectedStep,
  fieldsList
}: ButtonsProps<Model, Key>) => {
  const { isTablet, isMobile } = useMediaQuery()
  const { trigger, formState } = useFormContext<Model>()

  const busy = formState.isSubmitting || formState.isLoading

  console.log('selectedStep', selectedStep)

  const isLast = selectedStep === fieldsList.length - 1

  return (
    <ButtonGroup className={cx(elMb8, !isTablet && !isMobile && elMl8)} alignment="left">
      <Button
        intent="primary"
        onClick={handleSwitchStep<Model, Key>({
          selectedStep,
          trigger,
          setSelectedStep,
          fieldsList
        })}
        type={isLast ? 'submit' : 'button'}
        disabled={busy}
        loading={busy}
      >
        {isLast ? 'Submit' : 'Next'}
      </Button>
    </ButtonGroup>
  )
}

export const CreateFields = <Model extends FieldValues, Key extends KeyPath<Model>>({
  fieldNames,
  fieldConfig
}: {
  fieldNames: Key[]
  fieldConfig: ModelConfig<Model>
}) => (
  <>
    {fieldNames.map(fieldName => (
      <FieldParent key={fieldName} fieldName={fieldName} fieldConfig={fieldConfig[fieldName]} />
    ))}
  </>
)
