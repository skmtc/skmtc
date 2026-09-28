import { assertEquals } from '@std/assert'
import { join } from '@std/path/join'
import { resolve } from '@std/path/resolve'
import { isInsideRoot } from '@/lib/is-inside-root.ts'

const root = resolve('/home/u/app')

Deno.test('isInsideRoot - the root itself and anything below it', () => {
  assertEquals(isInsideRoot(root, root), true)
  assertEquals(isInsideRoot(root, join(root, 'src', 'x.ts')), true)
  assertEquals(isInsideRoot(root, join(root, 'src', '..', 'x.ts')), true)
})

Deno.test('isInsideRoot - a sibling sharing the prefix is outside', () => {
  assertEquals(isInsideRoot(root, resolve('/home/u/app-legacy/x.ts')), false)
  assertEquals(isInsideRoot(root, join(root, '..', 'app-legacy', 'x.ts')), false)
})

Deno.test('isInsideRoot - a path that climbs out is outside', () => {
  assertEquals(isInsideRoot(root, join(root, '..', 'x.ts')), false)
  assertEquals(isInsideRoot(root, resolve('/home/u')), false)
})

Deno.test('isInsideRoot - a first segment that merely begins with two dots is inside', () => {
  assertEquals(isInsideRoot(root, join(root, '..cache', 'x.ts')), true)
  assertEquals(isInsideRoot(root, join(root, '..cache')), true)
})
