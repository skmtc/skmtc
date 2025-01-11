import { Dispatch, Reducer, useReducer } from 'react'

export const useThunkReducer = <State, Action>(
  reducer: Reducer<State, Action>,
  initialState: State
): [State, Dispatch<Action>] => {
  const [state, dispatch] = useReducer(reducer, initialState)

  let customDispatch = (action: Action) => {
    if (typeof action === 'function') {
      action(customDispatch)
    } else {
      dispatch(action)
    }
  }

  return [state, customDispatch]
}
