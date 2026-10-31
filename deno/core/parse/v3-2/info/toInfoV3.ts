import type { OpenAPIV3 } from 'openapi-types'
import type { ParseContextType } from '@/context/parseTypes.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { toContactV3 } from '../contact/toContactV3.ts'
import { toLicenseV3 } from '../license/toLicenseV3.ts'
import { toSpecificationExtensionsV3 } from '../specificationExtensions/toSpecificationExtensionsV3.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { toInfoString, toPresentInfo } from '@/parse/toPresentInfo.ts'

export type ToInfoV3Args = {
  /** Required by the spec; a document without it still parses (see {@link toPresentInfo}). */
  info: OpenAPIV3.InfoObject | null | undefined
  stackTrail: StackTrail
  context: ParseContextType
}

export const toInfoV3 = ({ info, stackTrail, context }: ToInfoV3Args): OasInfo => {
  const presentInfo = toPresentInfo({ info, stackTrail, context })

  if (presentInfo === undefined) {
    return new OasInfo({ title: '', version: '' })
  }

  const { title, description, termsOfService, contact, license, version, ...skipped } = presentInfo

  const extensionFields = toSpecificationExtensionsV3({
    skipped,
    parent: presentInfo,
    context,
    stackTrail,
    parentType: 'info'
  })

  return new OasInfo({
    title: toInfoString({ value: title, key: 'title', parent: presentInfo, stackTrail, context }),
    description,
    termsOfService,
    contact: contact ? toContactV3(contact, stackTrail, context) : undefined,
    license: license ? toLicenseV3(license, stackTrail, context) : undefined,
    version: toInfoString({
      value: version,
      key: 'version',
      parent: presentInfo,
      stackTrail,
      context
    }),
    extensionFields
  })
}
