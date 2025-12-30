import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean // Computed value based on mode and system preference

  // Actions
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
  setIsDark: (isDark: boolean) => void // For system preference updates
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      isDark: false,

      setMode: (mode) => {
        set({ mode, isDark: mode === 'dark' })
      },

      toggleTheme: () => {
        const currentMode = get().mode
        const newMode = currentMode === 'dark' ? 'light' : 'dark'
        set({ mode: newMode, isDark: newMode === 'dark' })
      },

      setIsDark: (isDark) => {
        set({ isDark })
      },
    }),
    {
      name: 'presence-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
      }),
    }
  )
)

export default useThemeStore
