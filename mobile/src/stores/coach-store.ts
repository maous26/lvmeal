/**
 * Coach Store - Conseils, Analyses et Alertes proactifs LymIA
 *
 * Génère du contenu personnalisé basé sur:
 * - Profil utilisateur
 * - Habitudes alimentaires
 * - Données wellness (sommeil, stress, hydratation)
 * - Objectifs et progression
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LymIABrain, type UserContext, type CoachingAdvice } from '../services/lymia-brain'
import type { UserProfile } from '../types'

export type CoachItemType = 'tip' | 'analysis' | 'alert' | 'celebration'

export type CoachItemCategory =
  | 'nutrition'
  | 'metabolism'
  | 'wellness'
  | 'sport'
  | 'hydration'
  | 'sleep'
  | 'stress'
  | 'progress'
  | 'cooking'

export type CoachItemPriority = 'low' | 'medium' | 'high'

export interface CoachItem {
  id: string
  type: CoachItemType
  category: CoachItemCategory
  title: string
  message: string
  priority: CoachItemPriority
  source?: string // ANSES, INSERM, etc.
  data?: Record<string, unknown> // Données associées (graphiques, stats)
  actionLabel?: string
  actionRoute?: string // Navigation route
  isRead: boolean
  createdAt: string
  expiresAt?: string
}

export interface CoachContext {
  // From user profile
  firstName?: string
  goal?: string
  dietType?: string
  allergies?: string[]
  weight?: number
  // Cooking preferences
  cookingLevel?: 'beginner' | 'intermediate' | 'advanced'
  weekdayTime?: number // minutes available per meal on weekdays
  weekendTime?: number // minutes available per meal on weekends
  batchCooking?: boolean
  quickMealsOnly?: boolean
  // From today's data
  caloriesConsumed?: number
  caloriesTarget?: number
  proteinConsumed?: number
  proteinTarget?: number
  carbsConsumed?: number
  fatsConsumed?: number
  // Hydration
  waterConsumed?: number
  waterTarget?: number
  // From wellness
  sleepHours?: number
  sleepQuality?: number
  stressLevel?: number
  energyLevel?: number
  // From activity
  streak?: number
  level?: number
  xp?: number
  lastWorkout?: string
  // Historical
  weeklyCaloriesAvg?: number
  weeklyProteinAvg?: number
  weightTrend?: 'up' | 'down' | 'stable'
  // Time context
  currentHour?: number
  dayOfWeek?: number
}

interface CoachState {
  items: CoachItem[]
  unreadCount: number
  lastGeneratedAt: string | null
  context: CoachContext
  isGeneratingAI: boolean

  // Actions
  setContext: (context: Partial<CoachContext>) => void
  generateItems: () => void
  generateItemsWithAI: () => Promise<void> // NEW: LymIA Brain powered
  markAsRead: (itemId: string) => void
  markAllAsRead: () => void
  dismissItem: (itemId: string) => void
  clearExpired: () => void
  getUnreadCount: () => number
}

const generateId = () => `coach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

/**
 * Génère les items (conseils, analyses, alertes) basés sur le contexte
 */
function generateItemsFromContext(context: CoachContext): CoachItem[] {
  const items: CoachItem[] = []
  const now = new Date()
  const hour = context.currentHour ?? now.getHours()
  const firstName = context.firstName || ''

  // ========== ALERTES (priorité haute) ==========

  // Déficit calorique dangereux
  if (context.caloriesConsumed && context.caloriesTarget) {
    const ratio = context.caloriesConsumed / context.caloriesTarget

    if (ratio < 0.25 && hour >= 16) {
      items.push({
        id: generateId(),
        type: 'alert',
        category: 'nutrition',
        title: 'Déficit important détecté',
        message: `${firstName ? firstName + ', tu' : 'Tu'} n'as consommé que ${context.caloriesConsumed} kcal aujourd'hui (${Math.round(ratio * 100)}% de ton objectif). Un déficit trop important peut ralentir ton métabolisme et augmenter les fringales. Prends soin de toi avec un repas équilibré ce soir.`,
        priority: 'high',
        source: 'expert',
        data: { consumed: context.caloriesConsumed, target: context.caloriesTarget, ratio },
        isRead: false,
        createdAt: now.toISOString(),
      })
    } else if (ratio > 1.3) {
      items.push({
        id: generateId(),
        type: 'alert',
        category: 'nutrition',
        title: 'Objectif calorique dépassé',
        message: `Tu as dépassé ton objectif de ${Math.round((ratio - 1) * 100)}% aujourd'hui. Pas de panique ! Un écart occasionnel ne change rien sur le long terme. Demain est une nouvelle journée.`,
        priority: 'medium',
        source: 'expert',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // Manque de sommeil
  if (context.sleepHours !== undefined && context.sleepHours < 6) {
    items.push({
      id: generateId(),
      type: 'alert',
      category: 'sleep',
      title: 'Sommeil insuffisant',
      message: `${context.sleepHours}h de sommeil cette nuit, c'est peu. Le manque de sommeil augmente la ghréline (hormone de la faim) de 15% et réduit ta volonté. Sois indulgent avec toi-même aujourd'hui et essaie de te coucher plus tôt ce soir.`,
      priority: 'high',
      source: 'inserm',
      data: { sleepHours: context.sleepHours },
      isRead: false,
      createdAt: now.toISOString(),
    })
  }

  // Stress élevé
  if (context.stressLevel !== undefined && context.stressLevel >= 8) {
    items.push({
      id: generateId(),
      type: 'alert',
      category: 'stress',
      title: 'Niveau de stress élevé',
      message: `Ton stress est à ${context.stressLevel}/10 aujourd'hui. Le cortisol élevé peut favoriser le stockage abdominal et les envies de sucre. Accorde-toi 5 minutes de respiration profonde ou une petite marche.`,
      priority: 'high',
      source: 'has',
      actionLabel: 'Exercice de respiration',
      isRead: false,
      createdAt: now.toISOString(),
    })
  }

  // Déshydratation
  if (context.waterConsumed !== undefined && context.waterTarget) {
    const waterRatio = context.waterConsumed / context.waterTarget
    if (waterRatio < 0.3 && hour >= 14) {
      items.push({
        id: generateId(),
        type: 'alert',
        category: 'hydration',
        title: 'Pense à t\'hydrater',
        message: `Seulement ${context.waterConsumed}ml d'eau aujourd'hui. La déshydratation peut être confondue avec la faim et réduire ton énergie. Garde une bouteille d'eau près de toi !`,
        priority: 'medium',
        source: 'anses',
        actionLabel: 'Ajouter de l\'eau',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // ========== ANALYSES ==========

  // Analyse des protéines
  if (context.proteinConsumed && context.proteinTarget) {
    const proteinRatio = context.proteinConsumed / context.proteinTarget

    if (proteinRatio < 0.5 && hour >= 18) {
      items.push({
        id: generateId(),
        type: 'analysis',
        category: 'nutrition',
        title: 'Analyse protéines',
        message: `Tu as consommé ${context.proteinConsumed}g de protéines sur ${context.proteinTarget}g visés. Les protéines sont essentielles pour préserver ta masse musculaire, surtout en déficit calorique. Pour ton dîner, pense aux œufs, poisson, poulet ou légumineuses.`,
        priority: 'medium',
        source: 'anses',
        data: { consumed: context.proteinConsumed, target: context.proteinTarget },
        isRead: false,
        createdAt: now.toISOString(),
      })
    } else if (proteinRatio >= 1) {
      items.push({
        id: generateId(),
        type: 'analysis',
        category: 'nutrition',
        title: 'Objectif protéines atteint',
        message: `Excellent ! Tu as atteint ${context.proteinConsumed}g de protéines aujourd'hui. C'est parfait pour maintenir ta masse musculaire et ton métabolisme.`,
        priority: 'low',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // Analyse du sommeil (positif)
  if (context.sleepHours !== undefined && context.sleepHours >= 7 && context.sleepHours <= 9) {
    items.push({
      id: generateId(),
      type: 'analysis',
      category: 'sleep',
      title: 'Bon sommeil',
      message: `${context.sleepHours}h de sommeil, c'est dans la plage optimale ! Ton corps récupère bien, ta leptine (satiété) et ta ghréline (faim) sont équilibrées. Tu devrais avoir moins de fringales aujourd'hui.`,
      priority: 'low',
      source: 'inserm',
      isRead: false,
      createdAt: now.toISOString(),
    })
  }

  // Analyse énergie
  if (context.energyLevel !== undefined) {
    if (context.energyLevel <= 3) {
      items.push({
        id: generateId(),
        type: 'analysis',
        category: 'wellness',
        title: 'Énergie basse',
        message: `Ton niveau d'énergie est bas aujourd'hui. Cela peut être lié au sommeil, à l'alimentation ou au stress. Un en-cas avec des glucides complexes et protéines pourrait t'aider (ex: yaourt + fruits, toast + avocat).`,
        priority: 'medium',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // ========== CONSEILS ==========

  // Conseil matin - petit-déjeuner
  if (hour >= 6 && hour <= 9) {
    items.push({
      id: generateId(),
      type: 'tip',
      category: 'nutrition',
      title: 'Conseil petit-déjeuner',
      message: 'Un petit-déjeuner protéiné (œufs, fromage blanc, yaourt grec) stabilise ta glycémie et réduit les fringales de 11h. Les protéines augmentent aussi la thermogenèse de 20-30% !',
      priority: 'low',
      source: 'anses',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    })
  }

  // Conseil soir - sommeil
  if (hour >= 20 && hour <= 23) {
    items.push({
      id: generateId(),
      type: 'tip',
      category: 'sleep',
      title: 'Prépare ton sommeil',
      message: 'Évite les écrans 1h avant de dormir. La lumière bleue bloque la mélatonine. Préfère la lecture, un bain chaud ou des étirements pour une meilleure qualité de sommeil.',
      priority: 'low',
      source: 'inserm',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    })
  }

  // Conseil métabolisme (si objectif perte de poids)
  if (context.goal === 'weight_loss') {
    items.push({
      id: generateId(),
      type: 'tip',
      category: 'metabolism',
      title: 'Relance métabolique',
      message: 'En phase de perte de poids, augmente ton NEAT (activités quotidiennes) : prends les escaliers, marche en téléphonant, fais des pauses actives. Ça peut ajouter 200-400 kcal/jour sans effort !',
      priority: 'low',
      source: 'expert',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  // ========== CONSEILS CUISINE ==========

  // Conseil batch cooking le dimanche
  const dayOfWeek = context.dayOfWeek ?? now.getDay()
  if (context.batchCooking && dayOfWeek === 0 && hour >= 9 && hour <= 14) {
    items.push({
      id: generateId(),
      type: 'tip',
      category: 'cooking',
      title: 'Session batch cooking',
      message: 'C\'est dimanche, le moment parfait pour ton batch cooking ! Prépare tes bases de la semaine : protéines (poulet, œufs durs), légumes rôtis, et une sauce maison. 2h aujourd\'hui = repas sains toute la semaine.',
      priority: 'medium',
      source: 'expert',
      actionLabel: 'Voir les recettes batch',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    })
  }

  // Conseils adaptés au niveau de cuisine
  if (context.cookingLevel === 'beginner') {
    if (hour >= 11 && hour <= 13) {
      items.push({
        id: generateId(),
        type: 'tip',
        category: 'cooking',
        title: 'Astuce débutant',
        message: 'Pas besoin d\'être chef ! Les recettes les plus saines sont souvent les plus simples : poisson au four + légumes vapeur, pâtes + sauce tomate maison, ou salade composée. Moins de 20 min, résultats garantis.',
        priority: 'low',
        source: 'expert',
        isRead: false,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }
  } else if (context.cookingLevel === 'advanced') {
    if (dayOfWeek === 6 || dayOfWeek === 0) { // Weekend
      items.push({
        id: generateId(),
        type: 'tip',
        category: 'cooking',
        title: 'Challenge du week-end',
        message: `Tu as ${context.weekendTime || 60} min ce week-end - parfait pour tester une nouvelle recette ! Pourquoi pas un curry maison, des wraps healthy, ou un dessert protéiné ? C'est le moment de te faire plaisir sainement.`,
        priority: 'low',
        source: 'expert',
        actionLabel: 'Découvrir des recettes',
        isRead: false,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }
  }

  // Conseil temps limité en semaine
  if (context.quickMealsOnly || (context.weekdayTime && context.weekdayTime <= 20)) {
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 17 && hour <= 19) {
      items.push({
        id: generateId(),
        type: 'tip',
        category: 'cooking',
        title: 'Dîner express',
        message: 'Soirée chargée ? Voici des options rapides et nutritives : omelette aux légumes (10 min), bowl de quinoa + conserves de légumineuses (15 min), ou wrap au thon (5 min). Pas besoin de cuisiner longtemps pour bien manger !',
        priority: 'medium',
        source: 'expert',
        actionLabel: 'Recettes 15 min',
        isRead: false,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      })
    }
  }

  // ========== CÉLÉBRATIONS ==========

  // Streak
  if (context.streak) {
    if (context.streak === 7) {
      items.push({
        id: generateId(),
        type: 'celebration',
        category: 'progress',
        title: '1 semaine de streak !',
        message: `Bravo ${firstName} ! 7 jours consécutifs, c'est le début d'une habitude. Les études montrent qu'il faut 21 jours pour ancrer une habitude. Continue comme ça !`,
        priority: 'medium',
        isRead: false,
        createdAt: now.toISOString(),
      })
    } else if (context.streak === 21) {
      items.push({
        id: generateId(),
        type: 'celebration',
        category: 'progress',
        title: '21 jours - Habitude créée !',
        message: `Incroyable ${firstName} ! 21 jours consécutifs. Selon les neurosciences, tu as maintenant créé une nouvelle habitude. Ton cerveau a formé de nouvelles connexions neuronales.`,
        priority: 'high',
        isRead: false,
        createdAt: now.toISOString(),
      })
    } else if (context.streak === 30) {
      items.push({
        id: generateId(),
        type: 'celebration',
        category: 'progress',
        title: '1 mois complet !',
        message: `${firstName}, 30 jours de suite ! Tu fais partie des 8% de personnes qui tiennent leurs engagements aussi longtemps. Ta constance est remarquable.`,
        priority: 'high',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // Level up
  if (context.level && context.level > 1) {
    items.push({
      id: generateId(),
      type: 'celebration',
      category: 'progress',
      title: `Niveau ${context.level} atteint !`,
      message: `Tu progresses bien ! Chaque niveau représente ton engagement envers ta santé. Continue à accumuler de l'XP en trackant tes repas et ton bien-être.`,
      priority: 'low',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  return items
}

/**
 * Convert LymIA Brain coaching advice to CoachItem format
 */
function lymiaAdviceToCoachItem(advice: CoachingAdvice): CoachItem {
  const typeMap: Record<string, CoachItemType> = {
    alert: 'alert',
    nutrition: 'tip',
    wellness: 'tip',
    sport: 'tip',
    motivation: 'celebration',
  }

  const categoryMap: Record<string, CoachItemCategory> = {
    nutrition: 'nutrition',
    wellness: 'wellness',
    sport: 'sport',
    alert: 'nutrition',
    motivation: 'progress',
  }

  return {
    id: `lymia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: typeMap[advice.category] || 'tip',
    category: categoryMap[advice.category] || 'nutrition',
    title: advice.message.slice(0, 50) + (advice.message.length > 50 ? '...' : ''),
    message: advice.message,
    priority: advice.priority,
    source: advice.sources?.[0]?.source || 'lymia',
    data: { actionItems: advice.actionItems },
    isRead: false,
    createdAt: new Date().toISOString(),
    expiresAt: advice.priority === 'low'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  }
}

/**
 * Generate coaching items using LymIA Brain (AI-powered)
 */
async function generateItemsWithLymIA(context: CoachContext): Promise<CoachItem[]> {
  // Build LymIA context from coach context
  const userContext: UserContext = {
    profile: {
      firstName: context.firstName,
      goal: context.goal as UserProfile['goal'],
      dietType: context.dietType as UserProfile['dietType'],
      allergies: context.allergies,
      weight: context.weight || 70,
      height: 170, // Default
      age: 30, // Default
      gender: 'male', // Default
      activityLevel: 'moderate',
      cookingPreferences: {
        level: context.cookingLevel || 'intermediate',
        weekdayTime: context.weekdayTime || 30,
        weekendTime: context.weekendTime || 60,
        batchCooking: context.batchCooking || false,
        quickMealsOnly: context.quickMealsOnly || false,
      },
    } as UserProfile,
    todayNutrition: {
      calories: context.caloriesConsumed || 0,
      proteins: context.proteinConsumed || 0,
      carbs: context.carbsConsumed || 0,
      fats: context.fatsConsumed || 0,
    },
    weeklyAverage: {
      calories: context.weeklyCaloriesAvg || 0,
      proteins: context.weeklyProteinAvg || 0,
      carbs: 0,
      fats: 0,
    },
    currentStreak: context.streak || 0,
    lastMeals: [],
    wellnessData: {
      sleepHours: context.sleepHours,
      stressLevel: context.stressLevel,
      energyLevel: context.energyLevel,
      hydrationLiters: context.waterConsumed ? context.waterConsumed / 1000 : undefined,
    },
  }

  try {
    const advices = await LymIABrain.getCoachingAdvice(userContext)

    // Convert LymIA advices to CoachItems
    return advices.map(lymiaAdviceToCoachItem)
  } catch (error) {
    console.error('LymIA coaching generation failed:', error)
    // Fallback to static generation
    return generateItemsFromContext(context)
  }
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      items: [],
      unreadCount: 0,
      lastGeneratedAt: null,
      context: {},
      isGeneratingAI: false,

      setContext: (newContext) => {
        set((state) => ({
          context: { ...state.context, ...newContext },
        }))
      },

      generateItems: () => {
        const { context, items: existingItems } = get()
        const now = new Date()

        // Ne pas régénérer trop souvent (min 30 min)
        const lastGen = get().lastGeneratedAt
        if (lastGen) {
          const diff = now.getTime() - new Date(lastGen).getTime()
          if (diff < 30 * 60 * 1000) return
        }

        // Nettoyer les items expirés
        const validItems = existingItems.filter((item) => {
          if (!item.expiresAt) return true
          return new Date(item.expiresAt) > now
        })

        // Générer nouveaux items
        const newItems = generateItemsFromContext({
          ...context,
          currentHour: now.getHours(),
          dayOfWeek: now.getDay(),
        })

        // Éviter les doublons (même titre dans les dernières 12h)
        const recentTitles = new Set(
          validItems
            .filter((item) => {
              const age = now.getTime() - new Date(item.createdAt).getTime()
              return age < 12 * 60 * 60 * 1000
            })
            .map((item) => item.title)
        )

        const uniqueNewItems = newItems.filter((item) => !recentTitles.has(item.title))

        // Trier par priorité et date
        const allItems = [...uniqueNewItems, ...validItems]
          .sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 }
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
            if (priorityDiff !== 0) return priorityDiff
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
          .slice(0, 15) // Limiter à 15 items

        const unreadCount = allItems.filter((item) => !item.isRead).length

        set({
          items: allItems,
          unreadCount,
          lastGeneratedAt: now.toISOString(),
        })
      },

      // NEW: Generate items using LymIA Brain (AI-powered with RAG)
      generateItemsWithAI: async () => {
        const { context, items: existingItems, isGeneratingAI } = get()

        // Prevent concurrent generation
        if (isGeneratingAI) return

        set({ isGeneratingAI: true })

        try {
          const now = new Date()

          // Clean expired items
          const validItems = existingItems.filter((item) => {
            if (!item.expiresAt) return true
            return new Date(item.expiresAt) > now
          })

          // Generate AI-powered items using LymIA Brain
          const newItems = await generateItemsWithLymIA({
            ...context,
            currentHour: now.getHours(),
            dayOfWeek: now.getDay(),
          })

          // Avoid duplicates (same title in last 12h)
          const recentTitles = new Set(
            validItems
              .filter((item) => {
                const age = now.getTime() - new Date(item.createdAt).getTime()
                return age < 12 * 60 * 60 * 1000
              })
              .map((item) => item.title)
          )

          const uniqueNewItems = newItems.filter((item) => !recentTitles.has(item.title))

          // Sort by priority and date
          const allItems = [...uniqueNewItems, ...validItems]
            .sort((a, b) => {
              const priorityOrder = { high: 0, medium: 1, low: 2 }
              const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
              if (priorityDiff !== 0) return priorityDiff
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            })
            .slice(0, 15)

          const unreadCount = allItems.filter((item) => !item.isRead).length

          set({
            items: allItems,
            unreadCount,
            lastGeneratedAt: now.toISOString(),
            isGeneratingAI: false,
          })
        } catch (error) {
          console.error('AI coaching generation error:', error)
          set({ isGeneratingAI: false })
          // Fallback to static generation
          get().generateItems()
        }
      },

      markAsRead: (itemId) => {
        set((state) => {
          const items = state.items.map((item) =>
            item.id === itemId ? { ...item, isRead: true } : item
          )
          return {
            items,
            unreadCount: items.filter((item) => !item.isRead).length,
          }
        })
      },

      markAllAsRead: () => {
        set((state) => ({
          items: state.items.map((item) => ({ ...item, isRead: true })),
          unreadCount: 0,
        }))
      },

      dismissItem: (itemId) => {
        set((state) => {
          const items = state.items.filter((item) => item.id !== itemId)
          return {
            items,
            unreadCount: items.filter((item) => !item.isRead).length,
          }
        })
      },

      clearExpired: () => {
        const now = new Date()
        set((state) => {
          const items = state.items.filter((item) => {
            if (!item.expiresAt) return true
            return new Date(item.expiresAt) > now
          })
          return {
            items,
            unreadCount: items.filter((item) => !item.isRead).length,
          }
        })
      },

      getUnreadCount: () => {
        return get().items.filter((item) => !item.isRead).length
      },
    }),
    {
      name: 'coach-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
