import { match } from 'npm:ts-pattern@5.7.1'

export class EntityType {
  type: 'variable' | 'type'
  constructor(type: 'variable' | 'type') {
    this.type = type
  }

  toString(): string {
    return match(this.type)
      .with('variable', () => 'const')
      .with('type', () => 'type')
      .exhaustive()
  }
}
