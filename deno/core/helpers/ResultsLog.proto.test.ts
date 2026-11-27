import { assertEquals } from '@std/assert'
import { StackTrail } from '@/context/StackTrail.ts'
import { ResultsLog } from '@/helpers/ResultsLog.ts'

// Deno removes the `__proto__` accessor of `Object.prototype` and Node keeps
// it, so the test installs it for its length.
Deno.test('ResultsLog - a __proto__ frame stays a key where the runtime has the accessor', () => {
  const before = Object.getOwnPropertyDescriptor(Object.prototype, '__proto__')

  Object.defineProperty(Object.prototype, '__proto__', {
    configurable: true,
    get() {
      return Object.getPrototypeOf(this)
    },
    set(prototype) {
      Object.setPrototypeOf(this, prototype)
    }
  })

  try {
    const log = new ResultsLog()
    log.capture(new StackTrail(['query', '__proto__', 'main']), 'error')

    assertEquals(JSON.stringify(log.toTree()), '{"query":{"__proto__":{"main":"error"}}}')
  } finally {
    if (before) {
      Object.defineProperty(Object.prototype, '__proto__', before)
    } else {
      Reflect.deleteProperty(Object.prototype, '__proto__')
    }
  }
})
