/**
 * Meal Input Preferences Store
 *
 * Gère les préférences utilisateur pour les méthodes d'ajout de repas.
 * Permet d'épingler/désépingler les méthodes favorites pour un accès rapide.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Types de méthodes d'input disponibles
export type MealInputMethod =
  | 'search'
  | 'photo'
  | 'voice'
  | 'barcode'
  | 'ai-meal'
  | 'discover-recipes'
  | 'favorites'

// Configuration d'une méthode d'input
export interface MealInputMethodConfig {
  id: MealInputMethod
  label: string
  labelShort: string
  iconName: string
  color: string
  bgColor: string
  description: string
}

// Toutes les méthodes disponibles avec leur configuration
export const ALL_INPUT_METHODS: MealInputMethodConfig[] = [
  {
    id: 'search',
    label: 'Rechercher',
    labelShort: 'Recherche',
    iconName: 'Search',
    color: '#2563EB',
    bgColor: '#EBF5FF',
    description: 'Rechercher un aliment par son nom'
  },
  {
    id: 'photo',
    label: 'Photo',
    labelShort: 'Photo',
    iconName: 'Camera',
    color: '#E11D48',
    bgColor: '#FFF1F2',
    description: 'Scanner un repas avec la caméra'
  },
  {
    id: 'voice',
    label: 'Vocal',
    labelShort: 'Vocal',
    iconName: 'Mic',
    color: '#8B5CF6',
    bgColor: '#F3E8FF',
    description: 'Dicter votre repas à voix haute'
  },
  {
    id: 'barcode',
    label: 'Code-barres',
    labelShort: 'Scan',
    iconName: 'Barcode',
    color: '#10B981',
    bgColor: '#ECFDF5',
    description: 'Scanner le code-barres d\'un produit'
  },
  {
    id: 'ai-meal',
    label: 'Repas IA',
    labelShort: 'IA',
    iconName: 'Sparkles',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    description: 'Générer un repas personnalisé par l\'IA'
  },
  {
    id: 'discover-recipes',
    label: 'Découvrir',
    labelShort: 'Explorer',
    iconName: 'Globe',
    color: '#06B6D4',
    bgColor: '#ECFEFF',
    description: 'Explorer des recettes du monde entier'
  },
  {
    id: 'favorites',
    label: 'Mes favoris',
    labelShort: 'Favoris',
    iconName: 'Heart',
    color: '#EC4899',
    bgColor: '#FDF2F8',
    description: 'Accéder à vos aliments et recettes favoris'
  },
]

// Méthodes épinglées par défaut (les 3 plus essentielles)
export const DEFAULT_PINNED_METHODS: MealInputMethod[] = ['search', 'photo', 'voice']

// Limites
export const MIN_PINNED_METHODS = 1
export const MAX_PINNED_METHODS = 4

interface MealInputPreferencesState {
  // Méthodes épinglées (affichées en priorité)
  pinnedMethods: MealInputMethod[]

  // Statistiques d'utilisation pour suggestions intelligentes
  usageStats: Record<MealInputMethod, number>

  // Dernière méthode utilisée
  lastUsedMethod: MealInputMethod | null

  // Actions
  pinMethod: (methodId: MealInputMethod) => boolean
  unpinMethod: (methodId: MealInputMethod) => boolean
  togglePin: (methodId: MealInputMethod) => boolean
  reorderPinnedMethods: (newOrder: MealInputMethod[]) => void
  recordUsage: (methodId: MealInputMethod) => void
  resetToDefaults: () => void

  // Getters
  isPinned: (methodId: MealInputMethod) => boolean
  getPinnedMethodConfigs: () => MealInputMethodConfig[]
  getUnpinnedMethodConfigs: () => MealInputMethodConfig[]
  getSuggestedMethod: () => MealInputMethod | null
}

export const useMealInputPreferencesStore = create<MealInputPreferencesState>()(
  persist(
    (set, get) => ({
      pinnedMethods: DEFAULT_PINNED_METHODS,
      usageStats: {
        'search': 0,
        'photo': 0,
        'voice': 0,
        'barcode': 0,
        'ai-meal': 0,
        'discover-recipes': 0,
        'favorites': 0,
      },
      lastUsedMethod: null,

      pinMethod: (methodId) => {
        const { pinnedMethods } = get()

        // Déjà épinglé ?
        if (pinnedMethods.includes(methodId)) {
          return false
        }

        // Limite atteinte ?
        if (pinnedMethods.length >= MAX_PINNED_METHODS) {
          return false
        }

        set({ pinnedMethods: [...pinnedMethods, methodId] })
        return true
      },

      unpinMethod: (methodId) => {
        const { pinnedMethods } = get()

        // Pas épinglé ?
        if (!pinnedMethods.includes(methodId)) {
          return false
        }

        // Minimum atteint ?
        if (pinnedMethods.length <= MIN_PINNED_METHODS) {
          return false
        }

        set({ pinnedMethods: pinnedMethods.filter(id => id !== methodId) })
        return true
      },

      togglePin: (methodId) => {
        const { pinnedMethods, pinMethod, unpinMethod } = get()

        if (pinnedMethods.includes(methodId)) {
          return unpinMethod(methodId)
        } else {
          return pinMethod(methodId)
        }
      },

      reorderPinnedMethods: (newOrder) => {
        // Valider que tous les IDs sont valides et épinglés
        const { pinnedMethods } = get()
        const isValid = newOrder.every(id => pinnedMethods.includes(id)) &&
                       newOrder.length === pinnedMethods.length

        if (isValid) {
          set({ pinnedMethods: newOrder })
        }
      },

      recordUsage: (methodId) => {
        const { usageStats } = get()
        set({
          usageStats: {
            ...usageStats,
            [methodId]: (usageStats[methodId] || 0) + 1,
          },
          lastUsedMethod: methodId,
        })
      },

      resetToDefaults: () => {
        set({
          pinnedMethods: DEFAULT_PINNED_METHODS,
          usageStats: {
            'search': 0,
            'photo': 0,
            'voice': 0,
            'barcode': 0,
            'ai-meal': 0,
            'discover-recipes': 0,
            'favorites': 0,
          },
          lastUsedMethod: null,
        })
      },

      isPinned: (methodId) => {
        return get().pinnedMethods.includes(methodId)
      },

      getPinnedMethodConfigs: () => {
        const { pinnedMethods } = get()
        return pinnedMethods
          .map(id => ALL_INPUT_METHODS.find(m => m.id === id))
          .filter((m): m is MealInputMethodConfig => m !== undefined)
      },

      getUnpinnedMethodConfigs: () => {
        const { pinnedMethods } = get()
        return ALL_INPUT_METHODS.filter(m => !pinnedMethods.includes(m.id))
      },

      getSuggestedMethod: () => {
        const { usageStats, pinnedMethods } = get()

        // Trouver la méthode la plus utilisée qui n'est pas épinglée
        const unpinnedStats = Object.entries(usageStats)
          .filter(([id]) => !pinnedMethods.includes(id as MealInputMethod))
          .sort(([, a], [, b]) => b - a)

        if (unpinnedStats.length > 0 && unpinnedStats[0][1] > 3) {
          return unpinnedStats[0][0] as MealInputMethod
        }

        return null
      },
    }),
    {
      name: 'meal-input-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
