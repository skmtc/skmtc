import { cx } from '@linaria/core'
import {
  BodyText,
  InputWrap,
  InputGroup,
  Label,
  Select,
  FormLayout,
  elFadeIn,
  elMb8,
  InputError,
  Button,
  elMb5,
  SmallText,
} from '@reapit/elements'
import { Dispatch, FC, SetStateAction, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { COUNTRY_OPTIONS } from './contacts-country-options'
import { ContactFormSchema } from './contacts-validation-schema'

export const ADDRESS_TYPE_OPTIONS = [
  { name: 'Primary', value: 'primary' },
  { name: 'Secondary', value: 'secondary' },
  { name: 'Home', value: 'home' },
  { name: 'Work', value: 'work' },
  { name: 'Forwarding', value: 'forwarding' },
  { name: 'Company', value: 'company' },
  { name: 'Previous', value: 'previous' },
]

interface ContactsAddressesProps {
  form: UseFormReturn<ContactFormSchema, any>
}

export const handleAddAddress = (setHasAsAddress: Dispatch<SetStateAction<boolean>>, hasAddress: boolean) => () => {
  setHasAsAddress(!hasAddress)
}

export const ContactsAddresses: FC<ContactsAddressesProps> = ({ form }) => {
  const [hasSecondaryAddress, setHasSecondaryAddress] = useState<boolean>(false)
  const [hasWorkAddress, setHasWorkAddress] = useState<boolean>(false)

  const {
    register,
    formState: { errors },
  } = form

  return (
    <>
      <BodyText hasBoldText hasSectionMargin>
        Provide up to three addresses for your contact. All addresses are optional, only primary address is shown by
        default.
      </BodyText>
      <SmallText hasSectionMargin>Primary Address</SmallText>
      <FormLayout className={cx(elMb8, elFadeIn)}>
        <InputWrap>
          <InputGroup>
            <Select {...register('primaryAddress.type')} defaultValue="primary">
              <option key="default-option" value="">
                None selected
              </option>
              {ADDRESS_TYPE_OPTIONS.map(({ name, value }) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </Select>
            <Label>Address Type</Label>
          </InputGroup>
        </InputWrap>
        <InputWrap>
          <InputGroup
            {...register('primaryAddress.buildingName')}
            hasError={Boolean(errors.primaryAddress?.buildingName?.message)}
            type="text"
            label="Building Name"
            placeholder="Name of the building"
          />
          {errors.primaryAddress?.buildingName?.message && (
            <InputError message={errors.primaryAddress.buildingName.message} />
          )}
        </InputWrap>
        <InputWrap>
          <InputGroup
            {...register('primaryAddress.buildingNumber')}
            hasError={Boolean(errors.primaryAddress?.buildingNumber?.message)}
            type="text"
            label="Building Number"
            placeholder="Number of the building"
          />
          {errors.primaryAddress?.buildingNumber?.message && (
            <InputError message={errors.primaryAddress.buildingNumber.message} />
          )}
        </InputWrap>
        <InputWrap>
          <InputGroup
            {...register('primaryAddress.line1')}
            hasError={Boolean(errors.primaryAddress?.line1?.message)}
            type="text"
            label="Line 1"
            placeholder="Address line 1"
          />
          {errors.primaryAddress?.line1?.message && <InputError message={errors.primaryAddress.line1.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup
            {...register('primaryAddress.line2')}
            hasError={Boolean(errors.primaryAddress?.line2?.message)}
            type="text"
            label="Line 2"
            placeholder="Address line 2"
          />
          {errors.primaryAddress?.line2?.message && <InputError message={errors.primaryAddress.line2.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup
            {...register('primaryAddress.line3')}
            hasError={Boolean(errors.primaryAddress?.line3?.message)}
            type="text"
            label="Line 3"
            placeholder="Address line 3"
          />
          {errors.primaryAddress?.line3?.message && <InputError message={errors.primaryAddress.line3.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup
            {...register('primaryAddress.line4')}
            hasError={Boolean(errors.primaryAddress?.line4?.message)}
            type="text"
            label="Line 4"
            placeholder="Address line 4"
          />
          {errors.primaryAddress?.line4?.message && <InputError message={errors.primaryAddress.line4.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup
            {...register('primaryAddress.postcode')}
            hasError={Boolean(errors.primaryAddress?.postcode?.message)}
            type="text"
            label="Post Code"
            placeholder="Address post code"
          />
          {errors.primaryAddress?.postcode?.message && <InputError message={errors.primaryAddress.postcode.message} />}
        </InputWrap>
        <InputWrap>
          <InputGroup>
            <Select {...register('primaryAddress.countryId')} defaultValue="GB">
              <option key="default-option" value="">
                None selected
              </option>
              {COUNTRY_OPTIONS.map(({ name, value }) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </Select>
            <Label>Country</Label>
          </InputGroup>
        </InputWrap>
      </FormLayout>
      {hasSecondaryAddress ? (
        <>
          <SmallText hasSectionMargin>Secondary Address</SmallText>
          <FormLayout className={cx(elMb8, elFadeIn)}>
            <InputWrap>
              <InputGroup>
                <Select {...register('secondaryAddress.type')} defaultValue="secondary">
                  <option key="default-option" value="">
                    None selected
                  </option>
                  {ADDRESS_TYPE_OPTIONS.map(({ name, value }) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </Select>
                <Label>Address Type</Label>
              </InputGroup>
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('secondaryAddress.buildingName')}
                hasError={Boolean(errors.secondaryAddress?.buildingName?.message)}
                type="text"
                label="Building Name"
                placeholder="Name of the building"
              />
              {errors.secondaryAddress?.buildingName?.message && (
                <InputError message={errors.secondaryAddress.buildingName.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('secondaryAddress.buildingNumber')}
                hasError={Boolean(errors.secondaryAddress?.buildingNumber?.message)}
                type="text"
                label="Building Number"
                placeholder="Number of the building"
              />
              {errors.secondaryAddress?.buildingNumber?.message && (
                <InputError message={errors.secondaryAddress.buildingNumber.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('secondaryAddress.line1')}
                hasError={Boolean(errors.secondaryAddress?.line1?.message)}
                type="text"
                label="Line 1"
                placeholder="Address line 1"
              />
              {errors.secondaryAddress?.line1?.message && (
                <InputError message={errors.secondaryAddress.line1.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('secondaryAddress.line2')}
                hasError={Boolean(errors.secondaryAddress?.line2?.message)}
                type="text"
                label="Line 2"
                placeholder="Address line 2"
              />
              {errors.secondaryAddress?.line2?.message && (
                <InputError message={errors.secondaryAddress.line2.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('secondaryAddress.line3')}
                hasError={Boolean(errors.secondaryAddress?.line3?.message)}
                type="text"
                label="Line 3"
                placeholder="Address line 3"
              />
              {errors.secondaryAddress?.line3?.message && (
                <InputError message={errors.secondaryAddress.line3.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('secondaryAddress.line4')}
                hasError={Boolean(errors.secondaryAddress?.line4?.message)}
                type="text"
                label="Line 4"
                placeholder="Address line 4"
              />
              {errors.secondaryAddress?.line4?.message && (
                <InputError message={errors.secondaryAddress.line4.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('secondaryAddress.postcode')}
                hasError={Boolean(errors.secondaryAddress?.postcode?.message)}
                type="text"
                label="Post Code"
                placeholder="Address post code"
              />
              {errors.secondaryAddress?.postcode?.message && (
                <InputError message={errors.secondaryAddress.postcode.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup>
                <Select {...register('secondaryAddress.countryId')} defaultValue="GB">
                  <option key="default-option" value="">
                    None selected
                  </option>
                  {COUNTRY_OPTIONS.map(({ name, value }) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </Select>
                <Label>Country</Label>
              </InputGroup>
            </InputWrap>
          </FormLayout>
          <div className={elMb5}>
            <Button onClick={handleAddAddress(setHasSecondaryAddress, hasSecondaryAddress)} intent="default">
              Remove Secondary Address
            </Button>
          </div>
        </>
      ) : (
        <div className={elMb5}>
          <Button onClick={handleAddAddress(setHasSecondaryAddress, hasSecondaryAddress)} intent="default">
            Add Secondary Address
          </Button>
        </div>
      )}
      {hasWorkAddress ? (
        <>
          <SmallText hasSectionMargin>Work Address</SmallText>
          <FormLayout className={cx(elMb8, elFadeIn)}>
            <InputWrap>
              <InputGroup>
                <Select {...register('workAddress.type')} defaultValue="work">
                  <option key="default-option" value="">
                    None selected
                  </option>
                  {ADDRESS_TYPE_OPTIONS.map(({ name, value }) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </Select>
                <Label>Address Type</Label>
              </InputGroup>
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('workAddress.buildingName')}
                hasError={Boolean(errors.workAddress?.buildingName?.message)}
                type="text"
                label="Building Name"
                placeholder="Name of the building"
              />
              {errors.workAddress?.buildingName?.message && (
                <InputError message={errors.workAddress.buildingName.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('workAddress.buildingNumber')}
                hasError={Boolean(errors.workAddress?.buildingNumber?.message)}
                type="text"
                label="Building Number"
                placeholder="Number of the building"
              />
              {errors.workAddress?.buildingNumber?.message && (
                <InputError message={errors.workAddress.buildingNumber.message} />
              )}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('workAddress.line1')}
                hasError={Boolean(errors.workAddress?.line1?.message)}
                type="text"
                label="Line 1"
                placeholder="Address line 1"
              />
              {errors.workAddress?.line1?.message && <InputError message={errors.workAddress.line1.message} />}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('workAddress.line2')}
                hasError={Boolean(errors.workAddress?.line2?.message)}
                type="text"
                label="Line 2"
                placeholder="Address line 2"
              />
              {errors.workAddress?.line2?.message && <InputError message={errors.workAddress.line2.message} />}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('workAddress.line3')}
                hasError={Boolean(errors.workAddress?.line3?.message)}
                type="text"
                label="Line 3"
                placeholder="Address line 3"
              />
              {errors.workAddress?.line3?.message && <InputError message={errors.workAddress.line3.message} />}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('workAddress.line4')}
                hasError={Boolean(errors.workAddress?.line4?.message)}
                type="text"
                label="Line 4"
                placeholder="Address line 4"
              />
              {errors.workAddress?.line4?.message && <InputError message={errors.workAddress.line4.message} />}
            </InputWrap>
            <InputWrap>
              <InputGroup
                {...register('workAddress.postcode')}
                hasError={Boolean(errors.workAddress?.postcode?.message)}
                type="text"
                label="Post Code"
                placeholder="Address post code"
              />
              {errors.workAddress?.postcode?.message && <InputError message={errors.workAddress.postcode.message} />}
            </InputWrap>
            <InputWrap>
              <InputGroup>
                <Select {...register('workAddress.countryId')} defaultValue="GB">
                  <option key="default-option" value="">
                    None selected
                  </option>
                  {COUNTRY_OPTIONS.map(({ name, value }) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </Select>
                <Label>Country</Label>
              </InputGroup>
            </InputWrap>
          </FormLayout>
          <div className={elMb5}>
            <Button onClick={handleAddAddress(setHasWorkAddress, hasWorkAddress)} intent="default">
              Remove Work Address
            </Button>
          </div>
        </>
      ) : (
        <div className={elMb5}>
          <Button onClick={handleAddAddress(setHasWorkAddress, hasWorkAddress)} intent="default">
            Add Work Address
          </Button>
        </div>
      )}
    </>
  )
}
