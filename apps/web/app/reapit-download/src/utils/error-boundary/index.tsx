import { PersistentNotification } from '@reapit/elements'
import { Component, ErrorInfo, PropsWithChildren } from 'react'

export interface ErrorState {
  hasFailed: boolean
}

export class ErrorBoundary<T> extends Component<T & PropsWithChildren> {
  state = {
    hasFailed: false,
  }

  constructor(props: T & PropsWithChildren) {
    super(props)
  }

  static getDerivedStateFromError() {
    return {
      hasFailed: true,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ERROR BOUNDARY CAUGHT', error.message, info)
  }

  render() {
    if (this.state.hasFailed) {
      return (
        <PersistentNotification isFullWidth isExpanded isInline intent="danger">
          Something went wrong here, try refreshing your page.
        </PersistentNotification>
      )
    }

    return <>{this.props.children}</>
  }
}
