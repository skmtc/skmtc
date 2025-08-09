import { RootDenoJson } from './root-deno-json.ts'
import type { Manager } from './manager.ts'
import { Generator } from './generator.ts'
import * as Sentry from '@sentry/deno'
import invariant from 'tiny-invariant'
import { Jsr } from './jsr.ts'
import { Deployment } from './deployment.ts'
import { ClientJson } from './client-json.ts'
import { toAssets } from '../deploy/to-assets.ts'
import { toProjectPath } from './to-project-path.ts'

type AddGeneratorArgs = {
  packageName: string
  type: 'operation' | 'model'
}

type CloneGeneratorArgs = {
  packageName: string
}

type AddGeneratorOptions = {
  logSuccess?: string
}

type ConstructorArgs = {
  name: string
  generatorIds: string[]
  rootDenoJson: RootDenoJson
  manager: Manager
}

type DeployOptions = {
  logSuccess?: string
}

type InstallGeneratorArgs = {
  packageName: string
}

type InstallOptions = {
  logSuccess?: string
}

type RemoveGeneratorArgs = {
  packageName: string
}

type RemoveOptions = {
  logSuccess?: string
}

type CloneOptions = {
  logSuccess?: string
}

export class Project {
  name: string
  generatorIds: string[]
  rootDenoJson: RootDenoJson
  manager: Manager

  private constructor({ name, generatorIds, rootDenoJson, manager }: ConstructorArgs) {
    this.name = name
    this.generatorIds = generatorIds
    this.rootDenoJson = rootDenoJson
    this.manager = manager
  }

  static create(name: string, manager: Manager) {
    const project = new Project({
      name,
      generatorIds: [],
      rootDenoJson: RootDenoJson.create(name),
      manager
    })

    return project
  }

  async cloneGenerator({ packageName }: CloneGeneratorArgs, { logSuccess }: CloneOptions = {}) {
    try {
      const { scheme, scopeName, generatorName, version } = Generator.parseName(packageName)

      invariant(scheme === 'jsr', 'Only JSR registry generators are supported')

      const generator = Generator.fromName({
        scopeName,
        generatorName,
        version: version ?? (await Jsr.getLatestMeta({ scopeName, generatorName })).latest
      })

      await generator.clone({ denoJson: this.rootDenoJson })
    } catch (error) {
      Sentry.captureException(error)

      await Sentry.flush()

      this.manager.fail('Failed to clone generator')
    }
  }

  async installGenerator(
    { packageName }: InstallGeneratorArgs,
    { logSuccess }: InstallOptions = {}
  ) {
    try {
      const { scheme, scopeName, generatorName, version } = Generator.parseName(packageName)

      invariant(scheme === 'jsr', 'Only JSR registry generators are supported')

      const generator = Generator.fromName({
        scopeName,
        generatorName,
        version: version ?? (await Jsr.getLatestMeta({ scopeName, generatorName })).latest
      })

      generator.install({ denoJson: this.rootDenoJson })

      await this.manager.success()
    } catch (error) {
      Sentry.captureException(error)

      await Sentry.flush()

      this.manager.fail('Failed to install generator')
    }
  }

  async removeGenerator({ packageName }: RemoveGeneratorArgs, { logSuccess }: RemoveOptions = {}) {
    try {
      const { scopeName, generatorName, version } = Generator.parseName(packageName)

      const generator = Generator.fromName({ scopeName, generatorName, version: version ?? '' })

      generator.remove(this)

      await this.manager.success()
    } catch (error) {
      Sentry.captureException(error)

      await Sentry.flush()

      this.manager.fail('Failed to remove generator')
    }
  }

  async deploy({ logSuccess }: DeployOptions = {}) {
    const deployment = new Deployment(this.manager)

    const clientJson = await ClientJson.open(this.manager)

    const assets = await toAssets({ projectRoot: toProjectPath(this.name) })

    try {
      await deployment.deploy({
        assets,
        clientJson,
        projectName: this.name,
        generatorIds: this.generatorIds
      })

      this.manager.success()
    } catch (error) {
      console.error(error)

      Sentry.captureException(error)

      await Sentry.flush()

      this.manager.fail('Failed to deploy generators')
    }
  }

  async addGenerator(
    { packageName, type }: AddGeneratorArgs,
    { logSuccess }: AddGeneratorOptions = {}
  ) {
    try {
      const { scopeName, generatorName, version } = Generator.parseName(packageName)

      const generator = Generator.fromName({
        scopeName,
        generatorName,
        version: version ?? '0.0.1'
      })

      generator.add({ project: this, generatorType: type })
    } catch (error) {
      Sentry.captureException(error)

      await Sentry.flush()

      this.manager.fail('Failed to add generator')
    }
  }

  static async open(name: string, manager: Manager) {
    const rootDenoJson = await RootDenoJson.open(name, manager)

    const generatorIds = Object.keys(rootDenoJson.contents?.imports ?? {}).filter(importName => {
      const [scope, name, ...rest] = importName.split('/')

      if (rest.length > 0) {
        return false
      }

      if (!scope?.startsWith('@')) {
        return false
      }

      if (!name?.startsWith('gen-')) {
        return false
      }

      return true
    })

    return new Project({ name, generatorIds, rootDenoJson, manager })
  }
}
