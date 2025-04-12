"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// Create a custom hook to manage theme
export function useTheme() {
  const { theme, setTheme } = React.useContext(
    React.createContext({ theme: undefined, setTheme: (theme: string) => {} }),
  )

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light")
    } else {
      setTheme("dark")
    }
  }

  return { theme, setTheme, toggleTheme }
}
