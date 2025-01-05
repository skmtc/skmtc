import {
  BodyText,
  InputGroup,
  Label,
  FormLayout,
  elFadeIn,
  InputWrapFull,
  MultiSelectInput,
  InputError,
  MultiSelectOption,
  elMb3,
} from '@reapit/elements'
import { ChangeEvent, Dispatch, FC, SetStateAction, useCallback, useEffect, useState } from 'react'
import { UseFormGetValues, UseFormReturn } from 'react-hook-form'
import { ContactFormSchema } from './contacts-validation-schema'
import {
  ListItemModel,
  ContactModel,
  SourceModelPagedResult,
  NegotiatorModelPagedResult,
  OfficeModelPagedResult,
  NegotiatorModel,
  SourceModel,
  OfficeModel,
} from '@reapit/foundations-ts-definitions'
import debounce from 'just-debounce-it'
import { uniqueArray } from '../../../utils/array'
import { usePlatformGet } from '../../../hooks'

interface ContactsOfficeDetailsProps {
  form: UseFormReturn<ContactFormSchema, any>
  contact?: ContactModel | null
}

export const handleNegOptions =
  (
    negotiators: NegotiatorModelPagedResult | null,
    setNegOptions: Dispatch<SetStateAction<MultiSelectOption[]>>,
    getValues: UseFormGetValues<ContactFormSchema>,
    contact?: ContactModel | null,
  ) =>
  () => {
    const existingNegs: NegotiatorModel[] = (contact?._embedded ?? {})['negotiators'] ?? []
    const newNegs: NegotiatorModel[] = negotiators?._embedded ?? []
    const negotiatorIds = getValues('negotiatorIds') ?? ''
    const newOptions = [...existingNegs, ...newNegs].map(({ id, name }) => ({
      value: id ?? '',
      name: name ?? '',
    }))

    setNegOptions((options) => {
      const filteredOptions = options.filter(({ value }) => negotiatorIds.includes(value))
      return uniqueArray<MultiSelectOption>([...filteredOptions, ...newOptions])
    })
  }

export const handleSourceOptions =
  (
    sources: SourceModelPagedResult | null,
    setSourceOptions: Dispatch<SetStateAction<MultiSelectOption[]>>,
    getValues: UseFormGetValues<ContactFormSchema>,
    contact?: ContactModel | null,
  ) =>
  () => {
    const existingSource = (contact?._embedded ?? {})['source']
    const existingSources: SourceModel[] = existingSource ? [existingSource] : []
    const newSources: SourceModel[] = sources?._embedded ?? []
    const source = getValues('source') ?? ''
    const newOptions = [...newSources, ...existingSources].map(({ id, name, type }) => ({
      value: `${id}-${type}`,
      name: name ?? '',
    }))

    setSourceOptions((options) => {
      const filteredOptions = options.filter(({ value }) => source.includes(value))
      return uniqueArray<MultiSelectOption>([...filteredOptions, ...newOptions])
    })
  }

export const handleOfficeOptions =
  (
    offices: OfficeModelPagedResult | null,
    setOfficeOptions: Dispatch<SetStateAction<MultiSelectOption[]>>,
    getValues: UseFormGetValues<ContactFormSchema>,
    contact?: ContactModel | null,
  ) =>
  () => {
    const existingOffices: OfficeModel[] = (contact?._embedded ?? {})['offices'] ?? []
    const newOffices: OfficeModel[] = offices?._embedded ?? []
    const officeIds = getValues('officeIds') ?? ''
    const newOptions = [...existingOffices, ...newOffices].map(({ id, name }) => ({
      value: id ?? '',
      name: name ?? '',
    }))

    setOfficeOptions((options) => {
      const filteredOptions = options.filter(({ value }) => officeIds.includes(value))
      return uniqueArray<MultiSelectOption>([...filteredOptions, ...newOptions])
    })
  }

export const ContactsOfficeDetails: FC<ContactsOfficeDetailsProps> = ({ form, contact }) => {
  const [negsSearch, setNegsSearch] = useState<string>('')
  const [sourceSearch, setSourceSearch] = useState<string>('')
  const [officeSearch, setOfficeSearch] = useState<string>('')
  const [negsOptions, setNegsOptions] = useState<MultiSelectOption[]>([])
  const [sourceOptions, setSourceOptions] = useState<MultiSelectOption[]>([])
  const [officeOptions, setOfficeOptions] = useState<MultiSelectOption[]>([])

  const {
    register,
    getValues,
    formState: { errors },
  } = form

  const debouncedNegsSearch = useCallback(
    debounce((event: ChangeEvent<HTMLInputElement>) => setNegsSearch(event.target.value), 500),
    [500],
  )

  const debouncedSourceSearch = useCallback(
    debounce((event: ChangeEvent<HTMLInputElement>) => setSourceSearch(event.target.value), 500),
    [500],
  )

  const debouncedOfficeSearch = useCallback(
    debounce((event: ChangeEvent<HTMLInputElement>) => setOfficeSearch(event.target.value), 500),
    [500],
  )

  const [sources] = usePlatformGet<SourceModelPagedResult>({
    path: '/sources',
    queryParams: {
      name: sourceSearch,
      pageSize: 10,
    },
    fetchWhenTrue: [sourceSearch],
  })

  const [categories] = usePlatformGet<ListItemModel[]>({
    path: '/configuration/contactCategories',
    queryParams: {
      pageSize: 100,
    },
  })

  const [negotiators] = usePlatformGet<NegotiatorModelPagedResult>({
    path: '/negotiators',
    queryParams: {
      pageSize: 10,
      name: negsSearch,
    },
    fetchWhenTrue: [negsSearch],
  })

  const [offices] = usePlatformGet<OfficeModelPagedResult>({
    path: '/offices',
    queryParams: {
      pageSize: 10,
      name: officeSearch,
    },
    fetchWhenTrue: [officeSearch],
  })

  useEffect(handleNegOptions(negotiators, setNegsOptions, getValues, contact), [negotiators, contact])
  useEffect(handleSourceOptions(sources, setSourceOptions, getValues, contact), [sources, contact])
  useEffect(handleOfficeOptions(offices, setOfficeOptions, getValues, contact), [offices, contact])

  const negIds = getValues('negotiatorIds')?.split(',').filter(Boolean) ?? []
  const officeIds = getValues('officeIds')?.split(',').filter(Boolean) ?? []
  const categoryIds = getValues('categoryIds')?.split(',').filter(Boolean) ?? []
  const source = getValues('source')
  const sourceIds = source ? [source] : []

  return (
    <>
      <BodyText hasBoldText hasSectionMargin>
        Provide information here relating to your Reapit organisation & office.
      </BodyText>
      <FormLayout className={elFadeIn}>
        <InputWrapFull>
          <InputGroup
            className={elMb3}
            onChange={debouncedSourceSearch}
            icon="search"
            placeholder="Search"
            label="Source"
          />
          <MultiSelectInput
            id="source-select"
            {...register('source')}
            options={sourceOptions}
            defaultValues={sourceIds}
          />
          {errors.source?.message && <InputError message={errors.source.message} />}
        </InputWrapFull>
        <InputWrapFull>
          <InputGroup
            className={elMb3}
            onChange={debouncedNegsSearch}
            icon="search"
            placeholder="Search"
            label="Negotiators"
          />
          <MultiSelectInput
            id="negotiators-select"
            {...register('negotiatorIds')}
            options={negsOptions}
            defaultValues={negIds}
          />
          {errors.negotiatorIds?.message && <InputError message={errors.negotiatorIds.message} />}
        </InputWrapFull>
        <InputWrapFull>
          <InputGroup
            className={elMb3}
            onChange={debouncedOfficeSearch}
            icon="search"
            placeholder="Search"
            label="Offices"
          />
          <MultiSelectInput
            id="offices-select"
            {...register('officeIds')}
            options={officeOptions}
            defaultValues={officeIds}
          />
          {errors.officeIds?.message && <InputError message={errors.officeIds.message} />}
        </InputWrapFull>
        {categories && categories.length && (
          <InputWrapFull>
            <InputGroup>
              <Label>Categories</Label>
              <MultiSelectInput
                id="categories-select"
                {...register('categoryIds')}
                options={categories.map(({ value, id }) => ({
                  value: id ?? '',
                  name: value ?? '',
                }))}
                defaultValues={categoryIds}
              />
              {errors.categoryIds?.message && <InputError message={errors.categoryIds.message} />}
            </InputGroup>
          </InputWrapFull>
        )}
      </FormLayout>
    </>
  )
}
