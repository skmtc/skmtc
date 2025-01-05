import {
  BodyText,
  InputWrap,
  InputGroup,
  Label,
  Select,
  FormLayout,
  elFadeIn,
  InputError,
  Toggle,
  ElToggleItem,
} from '@reapit/elements'
import { FC } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { ContactFormSchema } from './contacts-validation-schema'

export const MARKETING_OPTIONS = [
  { value: 'grant', name: 'Granted' },
  { value: 'deny', name: 'Denied' },
  { value: 'notAsked', name: 'Not Asked' },
]

interface ContactsComsDetailsProps {
  form: UseFormReturn<ContactFormSchema, any>
}

export const ContactsComsDetails: FC<ContactsComsDetailsProps> = ({ form }) => {
  const {
    register,
    formState: { errors },
  } = form
  return (
    <>
      <BodyText hasBoldText hasSectionMargin>
        Provide here the communication details and marketing preferences of your contact.
      </BodyText>
      <FormLayout className={elFadeIn}>
        <InputWrap>
          <InputGroup
            label="Home Phone"
            placeholder="Please enter a telephone number"
            {...register('homePhone')}
            hasError={Boolean(errors.homePhone?.message)}
          />
          {errors.homePhone?.message && <InputError message={errors.homePhone.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup
            label="Work Phone"
            placeholder="Please enter a telephone number"
            {...register('workPhone')}
            hasError={Boolean(errors.workPhone?.message)}
          />
          {errors.workPhone?.message && <InputError message={errors.workPhone.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup
            label="Mobile Phone"
            placeholder="Please enter a telephone number"
            {...register('mobilePhone')}
            hasError={Boolean(errors.mobilePhone?.message)}
          />
          {errors.mobilePhone?.message && <InputError message={errors.mobilePhone.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup
            label="Email"
            type="email"
            placeholder="Please enter an email address"
            {...register('email')}
            hasError={Boolean(errors.email?.message)}
          />
          {errors.email?.message && <InputError message={errors.email.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup>
            <Select {...register('marketingConsent')}>
              <option key="default-option" value="">
                None selected
              </option>
              {MARKETING_OPTIONS.map(({ name, value }) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </Select>
            <Label>Marketing Consent</Label>
          </InputGroup>
          {errors.marketingConsent?.message && <InputError message={errors.marketingConsent.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup>
            <Toggle {...register('communicationPreferenceLetter')} id="com-pref-letter">
              <ElToggleItem>On</ElToggleItem>
              <ElToggleItem>Off</ElToggleItem>
            </Toggle>
            <Label>Communicate Preference Letter</Label>
          </InputGroup>
        </InputWrap>
        <InputWrap>
          <InputGroup>
            <Toggle {...register('communicationPreferenceEmail')} id="com-pref-email">
              <ElToggleItem>On</ElToggleItem>
              <ElToggleItem>Off</ElToggleItem>
            </Toggle>
            <Label>Communicate Preference Email</Label>
          </InputGroup>
        </InputWrap>
        <InputWrap>
          <InputGroup>
            <Toggle {...register('communicationPreferencePhone')} id="com-pref-phone">
              <ElToggleItem>On</ElToggleItem>
              <ElToggleItem>Off</ElToggleItem>
            </Toggle>
            <Label>Communicate Preference Phone</Label>
          </InputGroup>
        </InputWrap>
        <InputWrap>
          <InputGroup>
            <Toggle {...register('communicationPreferenceSMS')} id="com-pref-sms">
              <ElToggleItem>On</ElToggleItem>
              <ElToggleItem>Off</ElToggleItem>
            </Toggle>
            <Label>Communicate Preference SMS</Label>
          </InputGroup>
        </InputWrap>
      </FormLayout>
    </>
  )
}
