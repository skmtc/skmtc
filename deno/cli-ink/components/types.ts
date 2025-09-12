import type { User } from '@supabase/supabase-js'

export type ViewState =
  | {
      type: 'home'
    }
  | {
      type: 'projects'
    }
  | {
      type: 'login'
    }
  | {
      type: 'project'
      projectName: string
    }
  | {
      type: 'create-project'
    }

export type AlertState =
  | {
      type: 'info'
      message: string
    }
  | {
      type: 'warning'
      message: string
    }
  | {
      type: 'success'
      message: string
    }
  | {
      type: 'error'
      message: string
    }

export type AppState = {
  alert: AlertState | null
  user: User | null
  view: ViewState
}

export type AppAction =
  | {
      type: 'set-view'
      view: ViewState
    }
  | {
      type: 'set-user'
      user: User | null
    }
  | {
      type: 'set-alert'
      alert: AlertState
    }
