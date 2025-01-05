/* istanbul ignore file */
import { object, string, boolean, ObjectSchema } from 'yup'
import { specialCharsTest } from '../../../utils/validators'

export interface ContactFormSchema {
  title?: string
  forename?: string
  surname: string
  dateOfBirth?: string
  homePhone?: string
  workPhone?: string
  mobilePhone?: string
  email?: string
  marketingConsent: string
  communicationPreferenceLetter: boolean
  communicationPreferenceEmail: boolean
  communicationPreferencePhone: boolean
  communicationPreferenceSMS: boolean
  primaryAddress?: {
    type?: string
    buildingName?: string
    buildingNumber?: string
    line1?: string
    line2?: string
    line3?: string
    line4?: string
    postcode?: string
    countryId?: string
  }
  secondaryAddress?: {
    type?: string
    buildingName?: string
    buildingNumber?: string
    line1?: string
    line2?: string
    line3?: string
    line4?: string
    postcode?: string
    countryId?: string
  }
  workAddress?: {
    type?: string
    buildingName?: string
    buildingNumber?: string
    line1?: string
    line2?: string
    line3?: string
    line4?: string
    postcode?: string
    countryId?: string
  }
  source?: string
  categoryIds?: string
  negotiatorIds: string
  officeIds: string
  metaData?: Object
}

export const contactsValidationSchema = object().shape({
  title: string().trim(),
  forename: string().trim().test(specialCharsTest),
  surname: string().trim().required('Surname is a required field').test(specialCharsTest),
  dateOfBirth: string().trim(),
  homePhone: string().trim().test(specialCharsTest),
  workPhone: string().trim().test(specialCharsTest),
  mobilePhone: string().trim().test(specialCharsTest),
  email: string().trim().email('Must be a valid email address'),
  marketingConsent: string().trim().required('Marketing consent is a required field').test(specialCharsTest),
  communicationPreferenceLetter: boolean().required('Communication preference letter is a required field'),
  communicationPreferenceEmail: boolean().required('Communication preference email is a required field'),
  communicationPreferencePhone: boolean().required('Communication preference phone is a required field'),
  communicationPreferenceSMS: boolean().required('Communication preference SMS is a required field'),
  primaryAddress: object().shape({
    type: string().trim().test(specialCharsTest),
    buildingName: string().trim().test(specialCharsTest),
    buildingNumber: string().trim().test(specialCharsTest),
    line1: string().trim().test(specialCharsTest),
    line2: string().trim().test(specialCharsTest),
    line3: string().trim().test(specialCharsTest),
    line4: string().trim().test(specialCharsTest),
    postcode: string().trim().test(specialCharsTest),
    countryId: string().trim(),
  }),
  secondaryAddress: object().shape({
    type: string().trim().test(specialCharsTest),
    buildingName: string().trim().test(specialCharsTest),
    buildingNumber: string().trim().test(specialCharsTest),
    line1: string().trim().test(specialCharsTest),
    line2: string().trim().test(specialCharsTest),
    line3: string().trim().test(specialCharsTest),
    line4: string().trim().test(specialCharsTest),
    postcode: string().trim().test(specialCharsTest),
    countryId: string().trim(),
  }),
  workAddress: object().shape({
    type: string().trim().test(specialCharsTest),
    buildingName: string().trim().test(specialCharsTest),
    buildingNumber: string().trim().test(specialCharsTest),
    line1: string().trim().test(specialCharsTest),
    line2: string().trim().test(specialCharsTest),
    line3: string().trim().test(specialCharsTest),
    line4: string().trim().test(specialCharsTest),
    postcode: string().trim().test(specialCharsTest),
    countryId: string().trim(),
  }),
  source: string()
    .trim()
    .test({
      name: 'isValidSource',
      message: 'Only one source can be selected',
      test: (value) => {
        if (!value) return true
        return value.split(',').length <= 1
      },
    }),
  categoryIds: string().trim(),
  negotiatorIds: string().trim().required('At least one negotiator must be supplied'),
  officeIds: string().trim().required('At least one office must be supplied'),
}) as ObjectSchema<ContactFormSchema, any, any, ''>
