export const useFetchError = () => {
  return {
    handleFetchError: (error: unknown) => {
      console.error(error)
    }
  }
}
