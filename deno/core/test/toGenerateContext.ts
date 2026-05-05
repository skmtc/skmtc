import { GenerateContext, OasDocument, StackTrail } from '@skmtc/core'
import * as log from 'jsr:@std/log@0.224/logger'

export const toGenerateContext = () => {
  const context = new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new log.Logger('test', 'ERROR'),
    stackTrail: new StackTrail(),
    captureCurrentResult: () => {},
    // @ts-expect-error - mock implementation
    toGeneratorConfigMap: () => ({})
  })

  return context
}
