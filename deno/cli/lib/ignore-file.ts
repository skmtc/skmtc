import ignore, { type Ignore } from 'ignore'
import { join } from '@std/path/join'
import { EOL } from '@std/fs/eol'

const IGNORE_FILE_NAME = '.apifoundryignore'

const DEFAULT_IGNORE_FILE_CONTENTS = ['node_modules', '.git', '.yarn', '.DS_Store', '.apifoundry']

export class IgnoreFile {
  ignore: Ignore

  constructor(ignore: Ignore) {
    this.ignore = ignore
  }

  static async fromFile(path: string) {
    const joinedPath = join(Deno.cwd(), path, IGNORE_FILE_NAME)

    const ignoreFile = await Deno.readTextFile(joinedPath)

    const ignoreFileSplit = ignoreFile?.split(EOL) ?? []

    const ignoreInstance = ignore().add(DEFAULT_IGNORE_FILE_CONTENTS).add(ignoreFileSplit)

    return new IgnoreFile(ignoreInstance)
  }
}
