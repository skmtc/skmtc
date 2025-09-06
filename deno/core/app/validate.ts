export const checkProjectName = (name: string): string | undefined => {
  if (name.length < 2) {
    return 'Name must be at least 2 characters long'
  }

  if (name.length > 20) {
    return 'Name must be 20 characters or less'
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'Name must only contain lowercase letters, numbers and hyphens'
  }

  if (name.startsWith('-')) {
    return 'Name cannot start with a hyphen'
  }

  if (name.endsWith('-')) {
    return 'Name cannot end with a hyphen'
  }
}
