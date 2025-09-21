import { Spinner, ThemeProvider, extendTheme, defaultTheme } from '@inkjs/ui'
import { render, type TextProps, Text } from 'ink'

type ToSpinnerProps = {
  message: string
  sub?: string
}

export const toSpinner = ({ message, sub }: ToSpinnerProps) => {
  render(
    <ThemeProvider theme={customTheme}>
      <Spinner label={message} />
      {sub && <Text dimColor>{sub}</Text>}
    </ThemeProvider>
  )
}

const customTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: (): TextProps => ({
          color: 'yellow'
        })
      }
    }
  }
})
