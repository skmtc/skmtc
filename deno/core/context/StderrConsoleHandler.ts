import { ConsoleHandler } from '@std/log/console-handler'

/**
 * A `ConsoleHandler` that writes each line to stderr with `console.error`.
 *
 * `@std/log`'s `ConsoleHandler` writes every level with `console.log`,
 * which is stdout. A run's log lines go to stderr, so a host that prints
 * a result on stdout, such as `skmtc generate --json`, keeps stdout for
 * that result alone.
 */
export class StderrConsoleHandler extends ConsoleHandler {
  override log(message: string): void {
    console.error(message)
  }
}
