import { create } from 'zustand'

export interface GlobalState {}
export interface GlobalStore {
  globalState: GlobalState
  setGlobalState: (newState: Partial<GlobalState>) => void
}

export const useGlobalStore = create<GlobalStore>((set) => ({
  globalState: {},
  setGlobalState: (newState: Partial<GlobalState>) =>
    set(({ globalState }) => ({ globalState: { ...globalState, ...newState } })),
}))

/**
 * Not actually in use but here to extend and desmonstrate simple global state management
 *
 * First extend the GlobalState interface with your new state eg
 *
 * export interface GlobalState {
 *  foo: string
 * }
 *
 * Then add the new state to the initial state in the useGlobalStore hook
 *
 * export const useGlobalStore = create<GlobalStore>((set) => ({
 *  globalState: {
 *  foo: 'bar'
 *  },
 *  setGlobalState: (newState: Partial<GlobalState>) => set((state) => ({ ...state, ...newState })),
 * }))
 *
 * Then in your React component simply:
 * import { useGlobalStore } from 'src/stores'
 *
 * const {setGlobalState} = useGlobalStore()
 * setGlobalState({ foo: 'bar' }) // to update the state
 *
 * or
 *
 * const {globalState} = useGlobalStore()
 * console.log(globalState.foo) // 'bar' to read the state
 */
