import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { join } from '@std/path/join'
import {
  askYesNo,
  enableConfigMigrationOffer,
  offerConfigMigrations,
  shouldOfferConfigMigration,
  toRunOffersConfigMigration
} from '@/lib/config-migration-offer.ts'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { captureConsole, withConfigRoot } from '@/tests/config-files.mock.ts'

const legacyConfig = { settings: { basePath: 'src', system: { not: 'unknown' } } }

/** Runs `fn` with the offer on, as the CLI's entry point turns it on in interactive mode. */
const withOffer = async (fn: () => Promise<void>): Promise<void> => {
  enableConfigMigrationOffer(true)
  try {
    await fn()
  } finally {
    enableConfigMigrationOffer(false)
  }
}

/** An `ask` that records each question and answers `answer`. */
const recordingAsk = (answer: boolean) => {
  const questions: string[] = []
  return { questions, ask: (message: string) => (questions.push(message), answer) }
}

Deno.test('shouldOfferConfigMigration - only in interactive mode, and not with --json or in migrate config', () => {
  assertEquals(shouldOfferConfigMigration({ args: ['generate', 'pets'], inputMode: 'interactive' }), true)
  // Strict or agent mode: `--no-input`, or no TTY.
  assertEquals(shouldOfferConfigMigration({ args: ['generate', 'pets'], inputMode: 'strict' }), false)
  assertEquals(shouldOfferConfigMigration({ args: ['generate', 'pets', '--no-input'], inputMode: 'strict' }), false)
  assertEquals(shouldOfferConfigMigration({ args: ['generate', 'pets', '--json'], inputMode: 'interactive' }), false)
  assertEquals(shouldOfferConfigMigration({ args: ['migrate', 'config', 'pets'], inputMode: 'interactive' }), false)
  assertEquals(shouldOfferConfigMigration({ args: ['migrate', '--dry-run', 'config'], inputMode: 'interactive' }), false)
})

Deno.test('offerConfigMigrations - asks once, and on yes migrates before the command reads the project', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile, settingsPath }) => {
    const { questions, ask } = recordingAsk(true)

    await withOffer(async () => {
      const { stdout } = await captureConsole(async () => {
        await offerConfigMigrations({ projectNames: ['pets'], ask })
        // A second read in the same run does not ask again.
        await offerConfigMigrations({ projectNames: ['pets'], ask })
      })

      assertStringIncludes(stdout.join('\n'), 'renamed')
    })

    assertEquals(questions, [
      'pets uses client.json / settings.system, which are deprecated. Migrate to skmtc.config.json / settings.parse now?'
    ])
    assertEquals(readFile('pets', 'client.json'), undefined)
    assertEquals(
      readFile('pets', 'skmtc.config.json'),
      JSON.stringify({ settings: { basePath: 'src', parse: { not: 'unknown' } } }, null, 2)
    )

    // The command continues on the migrated config, with no deprecation warning.
    const { value: root, stderr } = await captureConsole(() => SkmtcRoot.open(createMockManager()))
    assertEquals(root.findProject('pets').clientJson.path, join(settingsPath('pets'), 'skmtc.config.json'))
    assertEquals(stderr, [])
  })
})

Deno.test('SkmtcRoot.open - on no, the command continues on the old names, with the warnings', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile, settingsPath }) => {
    const questions: string[] = []
    const before = readFile('pets', 'client.json')

    await withOffer(async () => {
      // SkmtcRoot.open asks through the default prompt: answer no on stdin.
      const promptStub = globalThis.prompt
      globalThis.prompt = (message?: string) => (questions.push(message ?? ''), 'n')

      try {
        const { value: root, stderr } = await captureConsole(() => SkmtcRoot.open(createMockManager()))

        assertEquals(root.findProject('pets').clientJson.path, join(settingsPath('pets'), 'client.json'))
        assertEquals(stderr.length, 2)
        assertStringIncludes(stderr[0], 'pets uses .settings/client.json, which is deprecated')
        assertStringIncludes(stderr[1], 'pets uses settings.system, which is deprecated')
        assertStringIncludes(stderr[1], 'Run: skmtc migrate config pets')
      } finally {
        globalThis.prompt = promptStub
      }
    })

    assertEquals(questions.length, 1)
    assertStringIncludes(questions[0], '(Y/n)')
    assertEquals(readFile('pets', 'client.json'), before)
    assertEquals(readFile('pets', 'skmtc.config.json'), undefined)
  })
})

/** Whether a run with `args` offers the migration (what `mod.ts` calls), with stdin and stdout a TTY or not. */
const toRunOffer = (args: string[], tty: boolean): boolean => {
  const stdinIsTerminal = Deno.stdin.isTerminal
  const stdoutIsTerminal = Deno.stdout.isTerminal
  Deno.stdin.isTerminal = () => tty
  Deno.stdout.isTerminal = () => tty

  try {
    return toRunOffersConfigMigration(args)
  } finally {
    Deno.stdin.isTerminal = stdinIsTerminal
    Deno.stdout.isTerminal = stdoutIsTerminal
  }
}

Deno.test('offerConfigMigrations - the run decides as mod.ts does: a TTY asks, and only a TTY', () => {
  assertEquals(toRunOffer(['generate', 'pets'], true), true)
})

Deno.test('offerConfigMigrations - strict or agent mode, --json and no TTY never ask', async () => {
  const runs: [string[], boolean][] = [
    [['generate', 'pets', '--no-input'], true],
    [['generate', 'pets', '--json'], true],
    [['generate', 'pets'], false]
  ]

  for (const [args, tty] of runs) {
    await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async ({ readFile }) => {
      const { questions, ask } = recordingAsk(true)

      enableConfigMigrationOffer(toRunOffer(args, tty))
      try {
        await offerConfigMigrations({ projectNames: ['pets'], ask })
      } finally {
        enableConfigMigrationOffer(false)
      }

      assertEquals(questions, [])
      assertEquals(readFile('pets', 'skmtc.config.json'), undefined)
    })
  }
})

Deno.test('offerConfigMigrations - a project the migration would refuse is not offered', async () => {
  const files = { 'client.json': legacyConfig, 'skmtc.config.json': legacyConfig }

  await withConfigRoot({ pets: files }, async () => {
    const { questions, ask } = recordingAsk(true)

    await withOffer(() => offerConfigMigrations({ projectNames: ['pets'], ask }))

    assertEquals(questions, [])

    // Reading it prints the warning with the reason.
    const { stderr } = await captureConsole(() => SkmtcRoot.open(createMockManager()))
    assertStringIncludes(stderr.join('\n'), 'has both skmtc.config.json and client.json')
    assertStringIncludes(stderr.join('\n'), 'does not choose between them')
  })
})

Deno.test('offerConfigMigrations - after a no, a second read in the same run does not ask again', async () => {
  await withConfigRoot({ pets: { 'client.json': legacyConfig } }, async () => {
    const { questions, ask } = recordingAsk(false)

    await withOffer(async () => {
      await offerConfigMigrations({ projectNames: ['pets'], ask })
      await offerConfigMigrations({ projectNames: ['pets'], ask })
    })

    assertEquals(questions.length, 1)
  })
})

Deno.test('offerConfigMigrations - a project already on the new names is not offered', async () => {
  await withConfigRoot({ pets: { 'skmtc.config.json': { settings: { basePath: 'src' } } } }, async () => {
    const { questions, ask } = recordingAsk(true)

    await withOffer(() => offerConfigMigrations({ projectNames: ['pets'], ask }))

    assertEquals(questions, [])
  })
})

Deno.test('askYesNo - empty and y are yes, n is no, and a cancelled prompt is no', () => {
  const promptStub = globalThis.prompt
  const answers: (string | null)[] = ['', 'y', 'Yes', 'n', 'no', null]
  const questions: string[] = []
  globalThis.prompt = (message?: string) => (questions.push(message ?? ''), answers.shift() ?? null)

  try {
    assertEquals([1, 2, 3, 4, 5, 6].map(() => askYesNo('Migrate?')), [true, true, true, false, false, false])
    assertEquals(questions[0], 'Migrate? (Y/n)')
  } finally {
    globalThis.prompt = promptStub
  }
})
