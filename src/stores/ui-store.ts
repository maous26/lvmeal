import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface UIState {
  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void

  // Navigation
  activeTab: string
  setActiveTab: (tab: string) => void

  // Modals
  modals: Record<string, boolean>
  openModal: (id: string) => void
  closeModal: (id: string) => void
  toggleModal: (id: string) => void

  // Toasts
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  // Loading states
  loadingStates: Record<string, boolean>
  setLoading: (key: string, value: boolean) => void
  isLoading: (key: string) => boolean

  // Onboarding
  onboardingDismissed: string[]
  dismissOnboardingTip: (tipId: string) => void
  hasSeenTip: (tipId: string) => boolean

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Sidebar (desktop)
  sidebarOpen: boolean
  toggleSidebar: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Navigation
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Modals
      modals: {},
      openModal: (id) => set((state) => ({ modals: { ...state.modals, [id]: true } })),
      closeModal: (id) => set((state) => ({ modals: { ...state.modals, [id]: false } })),
      toggleModal: (id) =>
        set((state) => ({ modals: { ...state.modals, [id]: !state.modals[id] } })),

      // Toasts
      toasts: [],
      addToast: (toast) => {
        const id = generateId()
        const duration = toast.duration || 3000
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))

        // Auto-remove after duration
        setTimeout(() => {
          get().removeToast(id)
        }, duration)
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      // Loading states
      loadingStates: {},
      setLoading: (key, value) =>
        set((state) => ({ loadingStates: { ...state.loadingStates, [key]: value } })),
      isLoading: (key) => get().loadingStates[key] || false,

      // Onboarding tips
      onboardingDismissed: [],
      dismissOnboardingTip: (tipId) =>
        set((state) => ({
          onboardingDismissed: [...state.onboardingDismissed, tipId],
        })),
      hasSeenTip: (tipId) => get().onboardingDismissed.includes(tipId),

      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Sidebar
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'presence-ui',
      partialize: (state) => ({
        theme: state.theme,
        onboardingDismissed: state.onboardingDismissed,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)
