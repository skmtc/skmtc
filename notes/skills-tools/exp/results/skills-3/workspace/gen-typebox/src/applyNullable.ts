/**
 * Render-time wrapper: widens an already-rendered TypeBox expression to a
 * union with `Type.Null()` when the schema is nullable. Only ever called
 * from inside a `toString()` body.
 */
export const applyNullable = (content: string, nullable: boolean | undefined): string =>
  nullable ? `Type.Union([${content}, Type.Null()])` : content
