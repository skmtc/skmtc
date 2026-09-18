import { assertThrows } from '@std/assert'
import * as v from 'valibot'
import { clientSettings } from './Settings.ts'

Deno.test('clientSettings.basePath - a forward relative path is accepted in every spelling', () => {
  for (const basePath of ['./src', 'src', '.', './', 'web/app/src', '.\\web\\app']) {
    v.parse(clientSettings, { basePath })
  }
})

Deno.test('clientSettings.basePath - a .. segment is rejected', () => {
  for (const basePath of ['../out', './src/../../out', '..\\out']) {
    assertThrows(
      () => v.parse(clientSettings, { basePath }),
      Error,
      'basePath',
      `basePath: '${basePath}'`
    )
  }
})

Deno.test('clientSettings.basePath - an absolute path is rejected on every host', () => {
  for (const basePath of ['/tmp/out', 'C:\\out', 'C:/out', '\\\\server\\share']) {
    assertThrows(
      () => v.parse(clientSettings, { basePath }),
      Error,
      'basePath',
      `basePath: '${basePath}'`
    )
  }
})

Deno.test('clientSettings.ejected - every export path spelling is accepted', () => {
  v.parse(clientSettings, {
    ejected: ['@/types/user.tsx', '/User.ts', 'types/x.ts', '@\\types\\y.ts']
  })
})

Deno.test('clientSettings.ejected - an entry that cannot be an export path is rejected', () => {
  for (const entry of ['../x.ts', 'C:\\x.ts', '@/', '']) {
    assertThrows(
      () => v.parse(clientSettings, { ejected: [entry] }),
      Error,
      'settings.ejected',
      `entry: '${entry}'`
    )
  }
})
