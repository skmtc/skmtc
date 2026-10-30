import { assertEquals, assertStringIncludes } from '@std/assert'
import {
  findPublishWorkflows,
  isRepository,
  parseGithubRemote,
  readOriginRemote,
  resolveRepository,
  resolveWorkflow
} from '@/lib/linked-repo-detect.ts'
import {
  makeLinkRepo,
  PUBLISH_ACTION_WORKFLOW,
  PUBLISH_CLI_WORKFLOW,
  TEST_WORKFLOW,
  UNSET_GIT_VARIABLES
} from '@/tests/mocks/link-repo.mock.ts'
import { withEnv } from '@/tests/mocks/env.mock.ts'

const withRepo = async (
  options: Parameters<typeof makeLinkRepo>[0],
  run: (root: string) => Promise<void>
): Promise<void> => {
  const root = await makeLinkRepo(options)
  try {
    await withEnv(UNSET_GIT_VARIABLES, () => run(root))
  } finally {
    await Deno.remove(root, { recursive: true })
  }
}

Deno.test('parseGithubRemote - reads owner/repo from each GitHub URL form, with or without .git', () => {
  for (const url of [
    'https://github.com/acme/pets',
    'https://github.com/acme/pets.git',
    'git@github.com:acme/pets',
    'git@github.com:acme/pets.git',
    'ssh://git@github.com/acme/pets',
    'ssh://git@github.com/acme/pets.git'
  ]) {
    assertEquals(parseGithubRemote(url), 'acme/pets', url)
  }
})

Deno.test('parseGithubRemote - gives nothing for another host', () => {
  for (const url of [
    'https://gitlab.com/acme/pets.git',
    'git@gitlab.com:acme/pets.git',
    'https://github.com.evil.test/acme/pets',
    'https://github.com/acme'
  ]) {
    assertEquals(parseGithubRemote(url), undefined, url)
  }
})

Deno.test('isRepository - follows the hub rule for owner/repo', () => {
  assertEquals(isRepository('acme/pets.api_v2'), true)
  assertEquals(isRepository('acme/.'), false)
  assertEquals(isRepository('acme/..'), false)
  assertEquals(isRepository('ac_me/pets'), false)
  assertEquals(isRepository(`${'a'.repeat(40)}/pets`), false)
})

Deno.test('readOriginRemote - reads the origin URL through sh, nothing without a remote', async () => {
  await withRepo({ remote: 'git@github.com:acme/pets.git' }, async root => {
    assertEquals(await readOriginRemote(root), 'git@github.com:acme/pets.git')
  })
  await withRepo({}, async root => {
    assertEquals(await readOriginRemote(root), undefined)
  })
})

Deno.test('resolveRepository - a GitHub origin gives owner/repo', async () => {
  await withRepo({ remote: 'https://github.com/acme/pets.git' }, async root => {
    assertEquals(await resolveRepository({ repoFlag: undefined, cwd: root }), {
      type: 'resolved',
      repository: 'acme/pets'
    })
  })
})

Deno.test('resolveRepository - a non-GitHub origin is invalid and names --repo', async () => {
  await withRepo({ remote: 'https://gitlab.com/acme/pets.git' }, async root => {
    const result = await resolveRepository({ repoFlag: undefined, cwd: root })
    assertEquals(result.type, 'invalid')
    if (result.type === 'invalid') assertStringIncludes(result.message, '--repo')
  })
})

Deno.test('resolveRepository - no remote is invalid and names --repo', async () => {
  await withRepo({}, async root => {
    const result = await resolveRepository({ repoFlag: undefined, cwd: root })
    assertEquals(result.type, 'invalid')
    if (result.type === 'invalid') assertStringIncludes(result.message, '--repo')
  })
})

Deno.test('resolveRepository - --repo wins over the remote, and must be owner/repo', async () => {
  await withRepo({ remote: 'https://gitlab.com/acme/pets.git' }, async root => {
    assertEquals(await resolveRepository({ repoFlag: 'acme/other', cwd: root }), {
      type: 'resolved',
      repository: 'acme/other'
    })
    assertEquals((await resolveRepository({ repoFlag: 'acme', cwd: root })).type, 'invalid')
  })
})

Deno.test('findPublishWorkflows - finds the workflows that use the action or run skmtc api publish', async () => {
  await withRepo(
    {
      workflows: {
        'test.yml': TEST_WORKFLOW,
        'publish.yaml': PUBLISH_CLI_WORKFLOW,
        'action.yml': PUBLISH_ACTION_WORKFLOW,
        'notes.txt': PUBLISH_CLI_WORKFLOW
      }
    },
    async root => {
      assertEquals(await findPublishWorkflows(root), [
        '.github/workflows/action.yml',
        '.github/workflows/publish.yaml'
      ])
    }
  )
})

Deno.test('resolveWorkflow - zero candidates is invalid and names --workflow', async () => {
  await withRepo({ workflows: { 'test.yml': TEST_WORKFLOW } }, async root => {
    const result = await resolveWorkflow({ workflowFlag: undefined, cwd: root })
    assertEquals(result.type, 'invalid')
    if (result.type === 'invalid') assertStringIncludes(result.message, '--workflow')
  })
})

Deno.test('resolveWorkflow - one candidate is the workflow', async () => {
  await withRepo(
    { workflows: { 'test.yml': TEST_WORKFLOW, 'publish.yml': PUBLISH_ACTION_WORKFLOW } },
    async root => {
      assertEquals(await resolveWorkflow({ workflowFlag: undefined, cwd: root }), {
        type: 'resolved',
        workflow: '.github/workflows/publish.yml'
      })
    }
  )
})

Deno.test('resolveWorkflow - two candidates is invalid, names --workflow and lists both', async () => {
  await withRepo(
    { workflows: { 'a.yml': PUBLISH_ACTION_WORKFLOW, 'b.yml': PUBLISH_CLI_WORKFLOW } },
    async root => {
      const result = await resolveWorkflow({ workflowFlag: undefined, cwd: root })
      assertEquals(result.type, 'invalid')
      if (result.type === 'invalid') {
        assertStringIncludes(result.message, '--workflow')
        assertStringIncludes(result.message, '.github/workflows/a.yml, .github/workflows/b.yml')
      }
    }
  )
})

Deno.test('resolveWorkflow - --workflow strips ./ and must be a file in .github/workflows/', async () => {
  await withRepo({}, async root => {
    assertEquals(
      await resolveWorkflow({ workflowFlag: './.github/workflows/release.yaml', cwd: root }),
      { type: 'resolved', workflow: '.github/workflows/release.yaml' }
    )
    for (const workflowFlag of [
      'publish.yml',
      '.github/publish.yml',
      '.github/workflows/nested/publish.yml',
      '.github/workflows/publish.json'
    ]) {
      const result = await resolveWorkflow({ workflowFlag, cwd: root })
      assertEquals(result.type, 'invalid', workflowFlag)
      if (result.type === 'invalid') assertStringIncludes(result.message, '--workflow')
    }
  })
})
