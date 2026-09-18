import { assert, assertEquals } from '@std/assert'
import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { toFileUrl } from '@std/path/to-file-url'
import { toBundleFsPath, toBundlePath } from '@/lib/to-bundle-path.ts'

// Expectations are built with the same std functions on every host, so the
// cases mean the same thing on Windows (`file:///D:/...`) as on POSIX.
Deno.test('toBundlePath', async t => {
  await t.step('is the file URL of bundle.js under an absolute project path', () => {
    const result = toBundlePath(resolve('/project'))

    assertEquals(result, toFileUrl(resolve('/project', 'bundle.js')).href)
    assert(result.startsWith('file:///'))
    assert(result.endsWith('/project/bundle.js'))
    assertEquals(result.includes('\\'), false)
  })

  await t.step('resolves a relative project path against the working directory', () => {
    const result = toBundlePath('./project')

    assertEquals(result, toFileUrl(resolve('project', 'bundle.js')).href)
    assert(result.startsWith('file:///'))
  })

  await t.step('percent-encodes a space, as a URL must', () => {
    const result = toBundlePath(resolve('/path/with spaces/project'))

    assert(result.endsWith('/with%20spaces/project/bundle.js'))
  })

  await t.step('a trailing slash on the project path makes no difference', () => {
    assertEquals(toBundlePath(resolve('/my-project/')), toBundlePath(resolve('/my-project')))
    assert(!toBundlePath(resolve('/my-project/')).includes('//bundle.js'))
  })

  await t.step('different projects give different URLs of the same shape', () => {
    const result1 = toBundlePath(resolve('/project1'))
    const result2 = toBundlePath(resolve('/project2'))

    assert(result1 !== result2)
    assert(result1.endsWith('/bundle.js') && result2.endsWith('/bundle.js'))
  })
})

Deno.test('toBundleFsPath', async t => {
  await t.step('joins bundle.js onto the project path in the host spelling', () => {
    assertEquals(toBundleFsPath('/project'), join('/project', 'bundle.js'))
    assertEquals(toBundleFsPath('./project'), join('project', 'bundle.js'))
  })

  await t.step('names a real file when the project has a bundle', async () => {
    const tempDir = await Deno.makeTempDir()
    try {
      await Deno.writeTextFile(join(tempDir, 'bundle.js'), 'export default {}')
      assertEquals(await exists(toBundleFsPath(tempDir)), true)
    } finally {
      await Deno.remove(tempDir, { recursive: true })
    }
  })
})
