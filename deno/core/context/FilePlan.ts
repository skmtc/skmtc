import type { GenerateContextType } from '@/context/generateTypes.ts'
import { ModelSubject, type PlannedSubject } from '@/context/Subject.ts'
import type { DeclaredProjection } from '@/dsl/DeclaredProjection.ts'
import { fromModelKey } from '@/helpers/refFns.ts'
import type { WorkspacePath } from '@/helpers/normalizeWorkspacePath.ts'
import { toVariantList } from '@/helpers/toVariantList.ts'
import type { Reach } from '@/parse/Reach.ts'

type FilePlanArgs = {
  context: GenerateContextType
  /** Every subject of the run, of each kind. */
  subjects: readonly PlannedSubject[]
  /** The projection classes the entries of the run declared, each one time. */
  projections: readonly DeclaredProjection[]
  reach: Reach
  /** Makes an export path a projection gives into the path of a file of the run. */
  toFilePath: (exportPath: string, generatorId: string) => WorkspacePath
}

/** What a subject holds: its own files, and the models it names. */
type Held = {
  /** The index of the file each declared projection of its kind maps it to. Two can map it to one file. */
  files: number[]
  /** The keys of the models it names. It holds the files of each, and of what each reaches. */
  models: readonly string[]
}

/**
 * Which subjects of a run hold each file, known before the run from what the
 * entries declared. A subject holds a file when it can write to it or read
 * from it:
 *
 * - a declared projection of the subject's kind maps the subject to the file;
 * - the file is one that a declared model projection maps a model to, and
 *   the subject names that model or a model that reaches it.
 *
 * When the last subject that holds a file has run, the file is complete.
 * {@link finish} gives those files.
 *
 * The plan may hold a file for longer than the run needs it: a reach can
 * have a model no generator gets to. It never knows a file that no declared
 * projection maps a subject to, so such a file is never given by `finish`.
 *
 * Many subjects name one model, so the plan counts in two steps: the
 * subjects left that name a model, and for a file, its own subjects left
 * plus the named models left that reach it. A model's reach is then read
 * one time, not one time for each subject that names the model.
 */
export class FilePlan {
  #context: GenerateContextType
  /** The declared projections, by the kind of subject they take. */
  #projections: Map<DeclaredProjection['type'], DeclaredProjection[]>
  #toFilePath: (exportPath: string, generatorId: string) => WorkspacePath
  #paths: WorkspacePath[] = []
  #indexes = new Map<WorkspacePath, number>()
  /** By a file's index: the holds on it by subjects left to run, plus the named models left that reach it. */
  #left: number[] = []
  #held = new Map<PlannedSubject, Held>()
  /** By a model's key: how many subjects that name it are left to run. */
  #namedLeft = new Map<string, number>()
  /** By a named model's key: the indexes of the files of every model it reaches, its own included. */
  #filesBehind = new Map<string, number[]>()
  /** By a model's key: the indexes of the files the declared model projections map it to. */
  #modelFiles = new Map<string, number[]>()

  /**
   * How many times a projection could not say where a subject's file is: a
   * static threw, or the subject's enrichments have variants and no `main`.
   * The run reports such a fault where it happens. The plan leaves the file out.
   */
  unanswered = 0

  constructor({ context, subjects, projections, reach, toFilePath }: FilePlanArgs) {
    this.#context = context
    this.#projections = Map.groupBy(projections, projection => projection.type)
    this.#toFilePath = toFilePath

    subjects.forEach(subject => {
      const files = this.#toFiles(subject)
      const models = subject.toNamedModels(reach)

      files.forEach(file => {
        this.#left[file] += 1
      })

      models.forEach(key => {
        const namedLeft = this.#namedLeft.get(key) ?? 0

        if (namedLeft === 0) {
          this.#toFilesBehind(key, reach).forEach(file => {
            this.#left[file] += 1
          })
        }

        this.#namedLeft.set(key, namedLeft + 1)
      })

      this.#held.set(subject, { files, models })
    })
  }

  /** Whether the plan knows the file at `path`. */
  has(path: WorkspacePath): boolean {
    return this.#indexes.has(path)
  }

  /** The files `subject` holds, while it is left to run. */
  filesOf(subject: PlannedSubject): WorkspacePath[] {
    const held = this.#held.get(subject)

    if (held === undefined) {
      return []
    }

    const behind = held.models.flatMap(key => this.#filesBehind.get(key) ?? [])

    return [...new Set([...held.files, ...behind])].map(file => this.#paths[file])
  }

  /**
   * `subject` has run. Gives the files that no subject left to run holds:
   * nothing writes to them or reads from them after this.
   */
  finish(subject: PlannedSubject): WorkspacePath[] {
    const held = this.#held.get(subject)

    if (held === undefined) {
      return []
    }

    this.#held.delete(subject)

    const released = held.models.flatMap(key => {
      const namedLeft = (this.#namedLeft.get(key) ?? 0) - 1

      this.#namedLeft.set(key, namedLeft)

      return namedLeft === 0 ? (this.#filesBehind.get(key) ?? []) : []
    })

    return [...held.files, ...released].flatMap(file => {
      this.#left[file] -= 1

      return this.#left[file] === 0 ? [this.#paths[file]] : []
    })
  }

  /** The files of every model a named model reaches, read one time for each named model. */
  #toFilesBehind(key: string, reach: Reach): number[] {
    const found = this.#filesBehind.get(key)

    if (found !== undefined) {
      return found
    }

    const reached = [...reach.ofModel(fromModelKey(key))]
    const files = [...new Set(reached.flatMap(model => this.#toModelFiles(model)))]

    this.#filesBehind.set(key, files)

    return files
  }

  /** The files the declared model projections map a model to, read one time for each model. */
  #toModelFiles(key: string): number[] {
    const found = this.#modelFiles.get(key)

    if (found !== undefined) {
      return found
    }

    const files = this.#toFiles(new ModelSubject(fromModelKey(key)))

    this.#modelFiles.set(key, files)

    return files
  }

  /** The files the declared projections of a subject's kind map it to, for each of its variants. */
  #toFiles(subject: PlannedSubject): number[] {
    const projections = this.#projections.get(subject.type) ?? []

    return projections.flatMap(projection => {
      try {
        const variants = toVariantList({
          opEnrichments: this.#context.readEnrichment([projection.id, ...subject.enrichmentPath]),
          generatorId: projection.id,
          operationLabel: subject.label
        })

        return variants.flatMap(variant => {
          const exportPath = subject.toExportPath({ projection, context: this.#context, variant })

          return exportPath === undefined ? [] : [this.#toIndex(this.#toFilePath(exportPath, projection.id))]
        })
      } catch {
        this.unanswered += 1

        return []
      }
    })
  }

  #toIndex(path: WorkspacePath): number {
    const found = this.#indexes.get(path)

    if (found !== undefined) {
      return found
    }

    const index = this.#paths.length

    this.#paths.push(path)
    this.#left.push(0)
    this.#indexes.set(path, index)

    return index
  }
}
