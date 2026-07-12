import { assertEquals, assert } from '@std/assert'
import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { toBundleFsPath, toBundlePath } from '@/lib/to-bundle-path.ts'

Deno.test('toBundlePath', async t => {
  await t.step('should create file URL with bundle.js for absolute path', () => {
    const result = toBundlePath('/project')

    assertEquals(result, 'file:///project/bundle.js')
    assert(result.startsWith('file://'))
    assert(result.endsWith('bundle.js'))
  })

  await t.step('should handle nested directory paths', () => {
    const result = toBundlePath('/path/to/project')

    assertEquals(result, 'file:///path/to/project/bundle.js')
    assert(result.startsWith('file://'))
    assert(result.endsWith('bundle.js'))
  })

  await t.step('should handle paths with spaces', () => {
    const result = toBundlePath('/path/with spaces/project')

    assertEquals(result, 'file:///path/with spaces/project/bundle.js')
    assert(result.includes('with spaces'))
  })

  await t.step('should handle paths with special characters', () => {
    const result = toBundlePath('/path/with-dashes_and_underscores')

    assertEquals(result, 'file:///path/with-dashes_and_underscores/bundle.js')
    assert(result.includes('with-dashes_and_underscores'))
  })

  await t.step('should handle relative paths', () => {
    const result = toBundlePath('./project')

    // join() normalizes './project' to 'project'
    assertEquals(result, 'file://project/bundle.js')
    assert(result.startsWith('file://'))
    assert(result.endsWith('bundle.js'))
  })

  await t.step('should handle parent directory relative paths', () => {
    const result = toBundlePath('../project')

    assertEquals(result, 'file://../project/bundle.js')
    assert(result.startsWith('file://'))
    assert(result.endsWith('bundle.js'))
  })

  await t.step('should handle root path', () => {
    const result = toBundlePath('/')

    assertEquals(result, 'file:///bundle.js')
    assert(result.startsWith('file://'))
    assert(result.endsWith('bundle.js'))
  })

  await t.step('should handle empty string path', () => {
    const result = toBundlePath('')

    assertEquals(result, 'file://bundle.js')
    assert(result.startsWith('file://'))
    assert(result.endsWith('bundle.js'))
  })

  await t.step('should handle path without trailing slash', () => {
    const result = toBundlePath('/my-project')

    assertEquals(result, 'file:///my-project/bundle.js')
    assert(!result.includes('//bundle.js'))
  })

  await t.step('should handle path with trailing slash', () => {
    const result = toBundlePath('/my-project/')

    // join() should handle the trailing slash correctly
    assertEquals(result, 'file:///my-project/bundle.js')
    assert(result.endsWith('bundle.js'))
  })

  await t.step('should create consistent format for multiple paths', () => {
    const result1 = toBundlePath('/project1')
    const result2 = toBundlePath('/project2')

    // Both should follow the same pattern
    assert(result1.startsWith('file://'))
    assert(result2.startsWith('file://'))
    assert(result1.endsWith('bundle.js'))
    assert(result2.endsWith('bundle.js'))
    assert(result1 !== result2)
  })

  await t.step('should handle paths with dots', () => {
    const result = toBundlePath('/path/to/project.name')

    assertEquals(result, 'file:///path/to/project.name/bundle.js')
    assert(result.includes('project.name'))
  })
})

Deno.test('toBundleFsPath', async t => {
  await t.step('returns the plain filesystem path to bundle.js', () => {
    assertEquals(toBundleFsPath('/project'), join('/project', 'bundle.js'))
  })

  await t.step(
    'resolves to a path @std/fs `exists` can stat — the toBundlePath URL form cannot',
    async () => {
      const projectPath = await Deno.makeTempDir()
      try {
        await Deno.writeTextFile(join(projectPath, 'bundle.js'), '// bundle')

        // Diagnosis: `toBundlePath` returns a `file://` URL *string*.
        // `@std/fs` `exists` treats that string as a literal path and
        // false-negatives even though bundle.js is on disk — the root
        // cause of the `skmtc bundle` "wasn't written" and doctor
        // "no bundle.js" false-failures.
        assertEquals(await exists(toBundlePath(projectPath), { isFile: true }), false)

        // Fix: `toBundleFsPath` returns a plain filesystem path that
        // `exists` resolves correctly.
        assertEquals(await exists(toBundleFsPath(projectPath), { isFile: true }), true)
      } finally {
        await Deno.remove(projectPath, { recursive: true })
      }
    }
  )
})
