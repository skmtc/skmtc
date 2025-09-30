import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useState, useEffect } from 'react'
import { getFilePathSuggestions, findSuggestionToApply } from '@/lib/file-path-suggestions.ts'
import { isUrl } from '@/lib/is-url.ts'

type FilePathPromptProps = {
  prompt: string
  defaultValue?: string
  extensions?: string[]
  basePath?: string
  setValue: (value: string) => void
}

export const FilePathPrompt = ({
  prompt,
  defaultValue,
  extensions = ['.json', '.yaml', '.yml'],
  basePath,
  setValue
}: FilePathPromptProps) => {
  const [response, setResponse] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [currentValue, setCurrentValue] = useState(defaultValue || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [lastTabValue, setLastTabValue] = useState<string | null>(null)
  const [cursorPosition, setCursorPosition] = useState((defaultValue || '').length)

  // Update suggestions when value changes
  useEffect(() => {
    const updateSuggestions = async () => {
      // Don't show suggestions for URLs
      if (isUrl(currentValue)) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      const newSuggestions = await getFilePathSuggestions(currentValue, {
        extensions,
        maxSuggestions: 20,
        basePath
      })
      setSuggestions(newSuggestions)
    }

    updateSuggestions()
  }, [currentValue, extensions, basePath])

  // Handle keyboard input
  useInput((input, key) => {
    // Don't handle input if already submitted
    if (response !== null) return

    // Handle tab key - Linux-style completion
    if (key.tab) {
      // Check if this is a second tab press with no change
      if (lastTabValue === currentValue && suggestions.length > 1) {
        // Second tab - show all suggestions
        setShowSuggestions(true)
        setLastTabValue(null)
        return
      }

      // First tab or value changed - try to complete
      const completion = findSuggestionToApply(currentValue, suggestions)
      if (completion) {
        setCurrentValue(completion)
        setCursorPosition(completion.length)
        setLastTabValue(completion)
        setShowSuggestions(false)
      } else {
        // No completion available - show suggestions if multiple
        if (suggestions.length > 1) {
          setShowSuggestions(true)
        }
        setLastTabValue(currentValue)
      }
      return
    }

    // Reset tab tracking on any other key
    setLastTabValue(null)
    setShowSuggestions(false)

    // Handle return key - submit
    if (key.return) {
      setValue(currentValue)
      setResponse(currentValue)
      return
    }

    // Handle escape key - clear suggestions
    if (key.escape) {
      setShowSuggestions(false)
      return
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newValue =
          currentValue.slice(0, cursorPosition - 1) + currentValue.slice(cursorPosition)
        setCurrentValue(newValue)
        setCursorPosition(cursorPosition - 1)
      }
      return
    }

    // Handle left arrow
    if (key.leftArrow) {
      if (cursorPosition > 0) {
        setCursorPosition(cursorPosition - 1)
      }
      return
    }

    // Handle right arrow
    if (key.rightArrow) {
      if (cursorPosition < currentValue.length) {
        setCursorPosition(cursorPosition + 1)
      }
      return
    }

    // Handle home key (Ctrl+A)
    if (key.ctrl && input === 'a') {
      setCursorPosition(0)
      return
    }

    // Handle end key (Ctrl+E)
    if (key.ctrl && input === 'e') {
      setCursorPosition(currentValue.length)
      return
    }

    // Handle regular character input
    if (input && !key.ctrl && !key.meta) {
      const newValue =
        currentValue.slice(0, cursorPosition) + input + currentValue.slice(cursorPosition)
      setCurrentValue(newValue)
      setCursorPosition(cursorPosition + input.length)
    }
  })

  // If already submitted, show the response
  if (response !== null) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text>{prompt}</Text>
        <Text dimColor>{response}</Text>
      </Box>
    )
  }

  // Render the input with cursor
  const beforeCursor = currentValue.slice(0, cursorPosition)
  const atCursor = currentValue[cursorPosition] || ' '
  const afterCursor = currentValue.slice(cursorPosition + 1)

  return (
    <Box flexDirection="column">
      <Text>{prompt}</Text>
      <Box>
        <Text>{beforeCursor}</Text>
        <Text inverse>{atCursor}</Text>
        <Text>{afterCursor}</Text>
      </Box>

      {/* Show suggestions list when triggered by second tab */}
      {showSuggestions && suggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Suggestions:</Text>
          {suggestions.map((suggestion, index) => (
            <Text key={index} dimColor>
              {' '}
              {suggestion}
            </Text>
          ))}
        </Box>
      )}

      {/* Show hint about single suggestion */}
      {!showSuggestions && suggestions.length === 1 && currentValue !== suggestions[0] && (
        <Text dimColor>Press Tab to complete: {suggestions[0]}</Text>
      )}

      {/* Show hint about multiple suggestions */}
      {!showSuggestions && suggestions.length > 1 && (
        <Text dimColor>
          Press Tab to complete, Tab twice to show all {suggestions.length} suggestions
        </Text>
      )}
    </Box>
  )
}
