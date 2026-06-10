import { GenerateContext, OasDocument } from '@skmtc/core'
import * as log from 'jsr:@std/log@0.224/logger'

export const toGenerateContext = () => {
  const context = new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new log.Logger('test', 'ERROR'),
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })

  return context
}
