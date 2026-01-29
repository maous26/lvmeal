import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DailyBalance } from '../types'
import { useGamificationStore, XP_REWARDS } from './gamification-store'

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

interface CaloricBankState {
  // Hydration state
  _hasHydrated: boolean

  // Solde hebdomadaire (7 jours glissants)
  dailyBalances: DailyBalance[]

  // Suivi de la semaine
  weekStartDate: string | null
  isFirstTime: boolean

  // Solde plaisir
  cheatMealBudget: number // calories économisées (solde unique hebdomadaire)
  lastCheatMealDate: string | null

  // Suivi des repas plaisir (max 2 par semaine)
  weeklyPlaisirCount: number
  plaisirDatesThisWeek: string[]

  // Bonus plaisir activé pour aujourd'hui (calories ajoutées à l'objectif)
  activePlaisirBonus: number
  activePlaisirDate: string | null

  // Actions
  initializeWeek: () => void
  confirmStartDay: () => void
  updateDailyBalance: (date: string, targetCalories: number, consumedCalories: number) => void
  usePlaisirMeal: (calories: number) => boolean // Renommé pour plus de clarté
  cleanOldBalances: () => void
  activatePlaisirBonus: () => { success: boolean; bonus: number; message: string } // Ajoute 50% du solde aux calories du jour
  deactivatePlaisirBonus: () => void // Désactive le bonus pour aujourd'hui

  // Getters
  getTotalSaved: () => number
  getTotalBalance: () => number
  getWeeklyBalance: () => DailyBalance[]
  canHavePlaisir: () => boolean // Condition principale : jour >= 3 ET solde >= 200 ET repas restants
  getCurrentDayIndex: () => number
  getDaysUntilNewWeek: () => number
  isFirstTimeSetup: () => boolean
  getPlaisirSuggestion: () => { available: boolean; budget: number; suggestion: string; maxPerMeal: number; requiresSplit: boolean; remainingPlaisirMeals: number }
  getMaxPlaisirPerMeal: () => number // min(solde, 600)
  requiresSplitConsumption: () => boolean // solde > 600
  getRemainingPlaisirMeals: () => number
  canUsePlaisirMeal: () => boolean
  getActivePlaisirBonus: () => number // Retourne le bonus actif pour aujourd'hui (0 si pas actif)
  isPlaisirBonusActiveToday: () => boolean // Vérifie si un bonus est actif aujourd'hui

  // Aliases pour rétrocompatibilité
  canHaveCheatMeal: () => boolean
  useCheatMeal: (calories: number) => boolean
  getCheatMealSuggestion: () => { available: boolean; budget: number; suggestion: string; maxPerMeal: number; requiresSplit: boolean; remainingPlaisirMeals: number }
}

// ============================================================================
// RÈGLES DU SOLDE PLAISIR (Bonus Repas)
// ============================================================================
//
// Principe : Économiser des calories pour les AJOUTER à un repas normal
// Le bonus s'ajoute aux calories du repas, ce n'est pas un remplacement.
//
// Exemple : Dîner prévu 600 kcal + bonus 400 kcal = 1000 kcal au total
//
// Accumulation :
// - L'utilisateur économise des calories au fil des jours
// - Solde max recommandé : ~1200 kcal (10% × 6 jours pour 2000 kcal/j)
// - Réinitialisé chaque semaine
//
// Déclenchement :
// - 1er bonus : jour >= 3 ET solde >= 200 kcal
// - 2ème bonus : si solde restant > 0 après le 1er
//
// Plafond par bonus : 600 kcal max (évite les gros excès)
// ============================================================================

// Seuil minimum pour débloquer un repas plaisir
const MIN_PLAISIR_THRESHOLD = 200

// Maximum de calories par repas plaisir (protection régime)
const MAX_PLAISIR_PER_MEAL = 600

// Jour minimum pour déclencher (0-indexed, donc 2 = jour 3)
const MIN_DAY_FOR_PLAISIR = 2

// Max 2 repas plaisir par semaine
const MAX_PLAISIR_MEALS_PER_WEEK = 2

export const useCaloricBankStore = create<CaloricBankState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      dailyBalances: [],
      weekStartDate: null,
      isFirstTime: true,
      cheatMealBudget: 0,
      lastCheatMealDate: null,
      weeklyPlaisirCount: 0,
      plaisirDatesThisWeek: [],
      activePlaisirBonus: 0,
      activePlaisirDate: null,

      initializeWeek: () => {
        const { weekStartDate } = get()
        if (!weekStartDate) {
          set({ weekStartDate: getTodayString(), isFirstTime: true, weeklyPlaisirCount: 0, plaisirDatesThisWeek: [] })
        } else {
          // Check if 7 days have passed
          const start = new Date(weekStartDate)
          const today = new Date()
          const daysPassed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          if (daysPassed >= 7) {
            // Nouvelle semaine : reset du budget ET du compteur de repas plaisir
            set({ weekStartDate: getTodayString(), dailyBalances: [], cheatMealBudget: 0, weeklyPlaisirCount: 0, plaisirDatesThisWeek: [] })
          }
        }
      },

      confirmStartDay: () => {
        set({ isFirstTime: false })
      },

      updateDailyBalance: (date, targetCalories, consumedCalories) => {
        const balance = targetCalories - consumedCalories

        set((state) => {
          const existingIndex = state.dailyBalances.findIndex(b => b.date === date)
          const newBalance: DailyBalance = {
            date,
            targetCalories,
            consumedCalories,
            balance,
            isCheatDay: false,
          }

          let updatedBalances: DailyBalance[]
          if (existingIndex >= 0) {
            updatedBalances = [...state.dailyBalances]
            updatedBalances[existingIndex] = newBalance
          } else {
            updatedBalances = [...state.dailyBalances, newBalance]
          }

          // Keep only last 7 days
          updatedBalances = updatedBalances
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 7)

          // Calculate new cheat meal budget
          const totalSaved = updatedBalances.reduce((acc, b) => acc + Math.max(0, b.balance), 0)

          return {
            dailyBalances: updatedBalances,
            cheatMealBudget: totalSaved,
          }
        })

        // Clean old balances
        get().cleanOldBalances()
      },

      useCheatMeal: (calories) => {
        const { cheatMealBudget, canHaveCheatMeal, getMaxPlaisirPerMeal, canUsePlaisirMeal } = get()
        const maxPerMeal = getMaxPlaisirPerMeal()

        // Vérifie si le cheat meal est disponible
        if (!canHaveCheatMeal()) {
          return false
        }

        // Vérifie si on a encore des repas plaisir disponibles cette semaine (max 2)
        if (!canUsePlaisirMeal()) {
          return false
        }

        // Vérifie si les calories demandées dépassent le budget total
        if (calories > cheatMealBudget) {
          return false
        }

        // Vérifie si les calories demandées dépassent le max par repas (règle de répartition)
        if (calories > maxPerMeal) {
          return false
        }

        const today = getTodayString()

        set((state) => {
          // Mark today as cheat day
          const updatedBalances = state.dailyBalances.map(b =>
            b.date === today ? { ...b, isCheatDay: true } : b
          )

          // Ajoute cette date aux repas plaisir de la semaine (si pas déjà fait aujourd'hui)
          const newPlaisirDates = state.plaisirDatesThisWeek.includes(today)
            ? state.plaisirDatesThisWeek
            : [...state.plaisirDatesThisWeek, today]

          return {
            dailyBalances: updatedBalances,
            cheatMealBudget: Math.max(0, state.cheatMealBudget - calories),
            lastCheatMealDate: today,
            weeklyPlaisirCount: newPlaisirDates.length,
            plaisirDatesThisWeek: newPlaisirDates,
          }
        })

        // Gamification
        const gamification = useGamificationStore.getState()
        gamification.incrementMetric('repas_plaisir_earned')
        gamification.addXP(XP_REWARDS.LOG_MEAL, 'Repas plaisir utilise')

        return true
      },

      // Alias pour la nouvelle nomenclature
      usePlaisirMeal: (calories: number) => {
        return get().useCheatMeal(calories)
      },

      cleanOldBalances: () => {
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const cutoffDate = sevenDaysAgo.toISOString().split('T')[0]

        set((state) => ({
          dailyBalances: state.dailyBalances.filter(b => b.date >= cutoffDate),
        }))
      },

      getTotalSaved: () => {
        const { dailyBalances } = get()
        return dailyBalances.reduce((acc, b) => acc + Math.max(0, b.balance), 0)
      },

      getTotalBalance: () => {
        const { dailyBalances } = get()
        return dailyBalances.reduce((acc, b) => acc + Math.max(0, b.balance), 0)
      },

      getCurrentDayIndex: () => {
        const { weekStartDate } = get()
        if (!weekStartDate) return 0
        const start = new Date(weekStartDate)
        const today = new Date()
        return Math.min(6, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      },

      getDaysUntilNewWeek: () => {
        const { weekStartDate } = get()
        if (!weekStartDate) return 7
        const start = new Date(weekStartDate)
        const today = new Date()
        const daysPassed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        return Math.max(0, 7 - daysPassed)
      },

      isFirstTimeSetup: () => {
        return get().isFirstTime
      },

      canHavePlaisir: () => {
        const { getCurrentDayIndex, getTotalBalance, canUsePlaisirMeal } = get()
        const dayIndex = getCurrentDayIndex()
        const balance = getTotalBalance()
        // Jour >= 3 (index >= 2) ET solde >= 200 kcal ET repas plaisir restants
        return dayIndex >= MIN_DAY_FOR_PLAISIR && balance >= MIN_PLAISIR_THRESHOLD && canUsePlaisirMeal()
      },

      getWeeklyBalance: () => {
        const { dailyBalances } = get()
        return dailyBalances.sort((a, b) => a.date.localeCompare(b.date))
      },

      canHaveCheatMeal: () => {
        // Simplifié : on utilise canHavePlaisir() comme source de vérité
        return get().canHavePlaisir()
      },

      // Vérifie si le budget doit être réparti sur plusieurs repas (> 600 kcal)
      requiresSplitConsumption: () => {
        const { cheatMealBudget } = get()
        return cheatMealBudget > MAX_PLAISIR_PER_MEAL
      },

      // Retourne le maximum de calories consommables par repas plaisir
      // Simple : min(solde, 600 kcal)
      getMaxPlaisirPerMeal: () => {
        const { cheatMealBudget } = get()
        return Math.min(cheatMealBudget, MAX_PLAISIR_PER_MEAL)
      },

      // Retourne le nombre de repas plaisir restants cette semaine
      getRemainingPlaisirMeals: () => {
        const { weeklyPlaisirCount } = get()
        return Math.max(0, MAX_PLAISIR_MEALS_PER_WEEK - weeklyPlaisirCount)
      },

      // Vérifie si on peut encore utiliser un repas plaisir cette semaine
      canUsePlaisirMeal: () => {
        const { weeklyPlaisirCount } = get()
        return weeklyPlaisirCount < MAX_PLAISIR_MEALS_PER_WEEK
      },

      // Retourne le bonus plaisir actif pour aujourd'hui (0 si pas actif)
      getActivePlaisirBonus: () => {
        const { activePlaisirBonus, activePlaisirDate } = get()
        const today = getTodayString()
        // Le bonus n'est valide que pour aujourd'hui
        if (activePlaisirDate === today) {
          return activePlaisirBonus
        }
        return 0
      },

      // Vérifie si un bonus plaisir est actif aujourd'hui
      isPlaisirBonusActiveToday: () => {
        const { activePlaisirDate } = get()
        return activePlaisirDate === getTodayString()
      },

      // Active le bonus plaisir : ajoute 50% du solde aux calories du jour
      // Max 2 utilisations par semaine
      activatePlaisirBonus: () => {
        const { cheatMealBudget, canHavePlaisir, canUsePlaisirMeal, isPlaisirBonusActiveToday, weeklyPlaisirCount, plaisirDatesThisWeek } = get()
        const today = getTodayString()

        // Vérifier si déjà actif aujourd'hui
        if (isPlaisirBonusActiveToday()) {
          return { success: false, bonus: 0, message: 'Bonus déjà actif aujourd\'hui' }
        }

        // Vérifier les conditions
        if (!canHavePlaisir()) {
          return { success: false, bonus: 0, message: 'Conditions non remplies pour activer le bonus' }
        }

        if (!canUsePlaisirMeal()) {
          return { success: false, bonus: 0, message: 'Tu as déjà utilisé tes 2 bonus cette semaine' }
        }

        // Calculer le bonus : 50% du solde, max 600 kcal
        const bonus = Math.min(Math.round(cheatMealBudget * 0.5), MAX_PLAISIR_PER_MEAL)

        if (bonus < 100) {
          return { success: false, bonus: 0, message: 'Solde insuffisant (min 100 kcal de bonus)' }
        }

        // Activer le bonus
        const newPlaisirDates = plaisirDatesThisWeek.includes(today)
          ? plaisirDatesThisWeek
          : [...plaisirDatesThisWeek, today]

        set({
          activePlaisirBonus: bonus,
          activePlaisirDate: today,
          cheatMealBudget: cheatMealBudget - bonus,
          weeklyPlaisirCount: newPlaisirDates.length,
          plaisirDatesThisWeek: newPlaisirDates,
        })

        // Gamification
        const gamification = useGamificationStore.getState()
        gamification.incrementMetric('repas_plaisir_earned')
        gamification.addXP(XP_REWARDS.LOG_MEAL, 'Bonus repas plaisir activé')

        return {
          success: true,
          bonus,
          message: `+${bonus} kcal ajoutées à ton objectif du jour !`
        }
      },

      // Désactive le bonus plaisir (rembourse les calories)
      deactivatePlaisirBonus: () => {
        const { activePlaisirBonus, activePlaisirDate, cheatMealBudget, plaisirDatesThisWeek } = get()
        const today = getTodayString()

        if (activePlaisirDate !== today || activePlaisirBonus === 0) {
          return
        }

        // Rembourser les calories au solde
        const updatedDates = plaisirDatesThisWeek.filter(d => d !== today)

        set({
          cheatMealBudget: cheatMealBudget + activePlaisirBonus,
          activePlaisirBonus: 0,
          activePlaisirDate: null,
          weeklyPlaisirCount: updatedDates.length,
          plaisirDatesThisWeek: updatedDates,
        })
      },

      getCheatMealSuggestion: () => {
        const { cheatMealBudget, canHavePlaisir, getMaxPlaisirPerMeal, requiresSplitConsumption, getRemainingPlaisirMeals, canUsePlaisirMeal, getCurrentDayIndex } = get()
        const available = canHavePlaisir()
        const canUseThisWeek = canUsePlaisirMeal()
        const maxPerMeal = getMaxPlaisirPerMeal()
        const requiresSplit = requiresSplitConsumption()
        const remainingMeals = getRemainingPlaisirMeals()
        const dayIndex = getCurrentDayIndex()

        let suggestion = ''

        // Cas où on a déjà utilisé les 2 bonus de la semaine
        if (!canUseThisWeek) {
          suggestion = `Tu as déjà utilisé tes 2 bonus cette semaine. Nouveau cycle, nouveaux bonus !`
        } else if (available) {
          // Messages bienveillants : on dit le budget bonus à ajouter sur un repas
          if (requiresSplit) {
            // Budget > 600 kcal → peut faire 2 bonus
            if (remainingMeals === 2) {
              suggestion = `Ajoute jusqu'à +${maxPerMeal} kcal sur un repas. Choisis ce qui te fait vraiment envie !`
            } else {
              suggestion = `Ajoute jusqu'à +${maxPerMeal} kcal sur ton dernier bonus repas de la semaine.`
            }
          } else {
            // Budget <= 600 kcal → un seul bonus
            suggestion = `Ajoute jusqu'à +${cheatMealBudget} kcal sur un repas de ton choix !`
          }
        } else if (dayIndex < MIN_DAY_FOR_PLAISIR) {
          // Pas encore jour 3
          const daysLeft = MIN_DAY_FOR_PLAISIR - dayIndex
          suggestion = `Encore ${daysLeft} jour${daysLeft > 1 ? 's' : ''} avant de débloquer ton bonus repas`
        } else {
          // Jour >= 3 mais solde insuffisant
          const needed = MIN_PLAISIR_THRESHOLD - cheatMealBudget
          suggestion = `Encore ${needed} kcal à économiser pour débloquer ton bonus`
        }

        return {
          available,
          budget: cheatMealBudget,
          suggestion,
          maxPerMeal,
          requiresSplit,
          remainingPlaisirMeals: remainingMeals,
        }
      },

      // Alias pour la nouvelle nomenclature
      getPlaisirSuggestion: () => {
        return get().getCheatMealSuggestion()
      },
    }),
    {
      name: 'presence-caloric-bank',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => () => {
        console.log('[CaloricBankStore] Hydrated')
        useCaloricBankStore.setState({ _hasHydrated: true })
      },
      partialize: (state) => ({
        dailyBalances: state.dailyBalances,
        weekStartDate: state.weekStartDate,
        isFirstTime: state.isFirstTime,
        cheatMealBudget: state.cheatMealBudget,
        lastCheatMealDate: state.lastCheatMealDate,
        weeklyPlaisirCount: state.weeklyPlaisirCount,
        plaisirDatesThisWeek: state.plaisirDatesThisWeek,
        activePlaisirBonus: state.activePlaisirBonus,
        activePlaisirDate: state.activePlaisirDate,
      }),
    }
  )
)

// Hydration hook - must be defined AFTER useCaloricBankStore
export const useCaloricBankStoreHydration = () => useCaloricBankStore((s) => s._hasHydrated)

export default useCaloricBankStore
