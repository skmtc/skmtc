import { AnnotationHandler, InnerLine } from "codehike/code"

export const focus: AnnotationHandler = {
  name: "focus",
  onlyIfAnnotated: true,
  Line: (props) => (
    <InnerLine
      merge={props}
      className="opacity-50 data-[focus]:opacity-100 px-2"
    />
  ),
  AnnotatedLine: ({ annotation, ...props }) => (
    <InnerLine
      merge={props}
      data-focus={true}
      className="bg-white dark:bg-gray-700"
    />
  ),
}
