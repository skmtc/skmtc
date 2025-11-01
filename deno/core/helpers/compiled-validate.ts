type PropertyKey = string | number | symbol

type Issue = {
  /** The error message of the issue. */
  readonly message: string
  /** The path of the issue, if any. */
  readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined
}
/** The path segment type of the issue. */
type PathSegment = {
  /** The key representing a path segment. */
  readonly key: PropertyKey
}

type Result<Output> = SuccessResult<Output> | FailureResult
/** The result interface if validation succeeds. */
interface SuccessResult<Output> {
  /** The typed output value. */
  readonly value: Output
  /** The non-existent issues. */
  readonly issues?: undefined
}

/** The result interface if validation fails. */
type FailureResult = {
  /** The issues of failed validation. */
  readonly issues: ReadonlyArray<Issue>
}

export const outputErrors = <Output>(result: Result<Output>) => {
  if (!('value' in result) && 'issues' in result) {
    result.issues.forEach((issue: Issue) => {
      console.error(issue.message)
      console.error(issue.path?.map(path => (typeof path === 'object' ? path.key : path)).join('.'))
    })

    throw new Error('Validation failed')
  }
}
