import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { useColorScheme, StatusBar } from 'react-native'
import { useThemeStore, type ThemeMode } from '../stores/theme-store'
import { lightColors, darkColors } from '../constants/theme'

type ThemeColors = typeof lightColors

interface ThemeContextType {
  colors: ThemeColors
  isDark: boolean
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme()
  const { mode, isDark, setMode, toggleTheme, setIsDark } = useThemeStore()

  // Update isDark based on mode and system preference
  useEffect(() => {
    if (mode === 'system') {
      setIsDark(systemColorScheme === 'dark')
    } else {
      setIsDark(mode === 'dark')
    }
  }, [mode, systemColorScheme, setIsDark])

  // Get the current color palette based on theme
  const colors = useMemo(() => {
    return isDark ? darkColors : lightColors
  }, [isDark])

  const value = useMemo(
    () => ({
      colors,
      isDark,
      mode,
      setMode,
      toggleTheme,
    }),
    [colors, isDark, mode, setMode, toggleTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg.primary}
      />
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Hook to get just the colors (convenience)
export function useColors() {
  const { colors } = useTheme()
  return colors
}

export default ThemeProvider
