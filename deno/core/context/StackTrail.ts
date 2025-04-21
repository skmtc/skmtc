import { componentsKeys } from '../oas/components/Components.ts'

export class StackTrail {
  #stack: (string | number)[]

  constructor(stack: (string | number)[] = []) {
    this.#stack = stack
  }

  clone() {
    return new StackTrail([...this.#stack])
  }

  slice(start: number, end?: number) {
    return new StackTrail(this.#stack.slice(start, end))
  }

  includes(frames: string[]) {
    return frames.every(frame => this.#stack.includes(frame))
  }

  get stackTrail() {
    return this.#stack
  }

  append(frame: string | string[]): StackTrail {
    if (typeof frame === 'string') {
      this.#stack.push(frame)

      return this
    }

    if (Array.isArray(frame)) {
      frame.forEach(p => this.append(p))

      return this
    }

    throw new Error(`Unexpected stack frame: ${frame}`)
  }

  getParentOf(frame: string): string | undefined {
    const lastItemIndex = this.stackTrail.length - 1
    if (
      this.stackTrail?.[lastItemIndex] === frame &&
      this.stackTrail?.[lastItemIndex - 1] === 'properties'
    ) {
      const parentName = this.stackTrail?.[lastItemIndex - 2]
      return typeof parentName === 'string' ? parentName : undefined
    }
  }

  toStackRef(): string | undefined {
    const [first, second, third] = this.stackTrail

    if (first !== 'components') {
      return
    }

    if (typeof second !== 'string' || !componentsKeys.includes(second)) {
      return
    }

    if (typeof third !== 'string') {
      return
    }

    return `#/${first}/${second}/${third}`
  }

  remove(frame: string | string[]): StackTrail {
    if (typeof frame === 'string') {
      const lastItem = this.#stack[this.#stack.length - 1]

      if (lastItem !== frame) {
        throw new Error(`Expected to remove frame '${frame}' but found '${lastItem}'`)
      }

      this.#stack.pop()

      return this
    }

    if (Array.isArray(frame)) {
      frame.toReversed().forEach(p => this.remove(p))

      return this
    }

    throw new Error(`Unexpected stack frame: ${frame}`)
  }

  static join(...stacks: (StackTrail | string)[]): string {
    return stacks.map(stack => stack.toString()).join(':')
  }

  static parse(value: string): StackTrail {
    const stack = value.split(':').map(item => {
      if (!item) {
        throw new Error(`Empty stack trail token in: ${value}`)
      }

      return item.replaceAll('%3A', ':')
    })

    return new StackTrail(stack)
  }

  toJSON() {
    return this.toString()
  }

  toString() {
    return this.#stack
      .map(item => {
        return typeof item === 'string' ? item.replaceAll(':', '%3A') : item
      })
      .join(':')
  }
}
