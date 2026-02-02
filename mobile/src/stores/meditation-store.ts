/**
 * Meditation Store - Gestion du cache et de la progression des méditations orales
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { meditationTTSService, MEDITATION_SESSIONS, type MeditationSession, type MeditationStatus } from '../services/meditation-tts-service'
import { useGamificationStore, XP_REWARDS } from './gamification-store'
import { analytics } from '../services/analytics-service'

export interface MeditationProgress {
  sessionId: string
  completedAt: string | null
  listenCount: number
  lastPosition: number // Position en ms pour reprendre
  totalListenTime: number // Temps total écouté en ms
}

export interface MeditationCacheInfo {
  sessionId: string
  isCached: boolean
  cachedAt: string | null
}

interface MeditationState {
  // Cache status
  cachedSessions: MeditationCacheInfo[]

  // Progress tracking
  sessionProgress: MeditationProgress[]
  currentSessionId: string | null
  currentStatus: MeditationStatus
  currentPosition: number
  duration: number

  // Stats
  totalMeditationMinutes: number
  sessionsCompleted: number
  currentStreak: number
  longestStreak: number
  lastMeditationDate: string | null

  // Actions
  initializeCache: () => Promise<void>
  checkCacheStatus: (sessionId: string) => Promise<boolean>
  generateAudio: (session: MeditationSession) => Promise<void>

  // Playback
  playSession: (sessionId: string) => Promise<void>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  stopSession: () => Promise<void>
  seekTo: (position: number) => Promise<void>

  // Progress
  updateProgress: (sessionId: string, position: number, completed?: boolean) => void
  getSessionProgress: (sessionId: string) => MeditationProgress | null
  markSessionCompleted: (sessionId: string) => void

  // Status updates
  setStatus: (status: MeditationStatus) => void
  setPosition: (position: number) => void
  setDuration: (duration: number) => void

  // Cache management
  clearCache: () => Promise<void>
  getCacheSize: () => Promise<number>

  // Helpers
  getUnlockedSessions: (currentWeek: number) => MeditationSession[]
  getNextSession: () => MeditationSession | null
}

const getDateString = () => new Date().toISOString().split('T')[0]

export const useMeditationStore = create<MeditationState>()(
  persist(
    (set, get) => ({
      cachedSessions: [],
      sessionProgress: [],
      currentSessionId: null,
      currentStatus: 'idle',
      currentPosition: 0,
      duration: 0,
      totalMeditationMinutes: 0,
      sessionsCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastMeditationDate: null,

      initializeCache: async () => {
        await meditationTTSService.initializeCache()

        // Vérifier le status de cache pour chaque session
        const cacheStatus: MeditationCacheInfo[] = []

        for (const session of MEDITATION_SESSIONS) {
          const isCached = await meditationTTSService.isAudioCached(session.id)
          cacheStatus.push({
            sessionId: session.id,
            isCached,
            cachedAt: isCached ? new Date().toISOString() : null,
          })
        }

        set({ cachedSessions: cacheStatus })
      },

      checkCacheStatus: async (sessionId) => {
        const isCached = await meditationTTSService.isAudioCached(sessionId)

        set(state => ({
          cachedSessions: state.cachedSessions.map(c =>
            c.sessionId === sessionId
              ? { ...c, isCached, cachedAt: isCached ? c.cachedAt || new Date().toISOString() : null }
              : c
          ),
        }))

        return isCached
      },

      generateAudio: async (session) => {
        set({ currentStatus: 'generating' })

        try {
          await meditationTTSService.generateAndCacheAudio(session, (status) => {
            set({ currentStatus: status })
          })

          // Mettre à jour le cache status
          set(state => ({
            cachedSessions: state.cachedSessions.map(c =>
              c.sessionId === session.id
                ? { ...c, isCached: true, cachedAt: new Date().toISOString() }
                : c
            ),
            currentStatus: 'ready',
          }))
        } catch (error) {
          set({ currentStatus: 'error' })
          throw error
        }
      },

      playSession: async (sessionId) => {
        const { currentSessionId, stopSession, sessionProgress } = get()

        // Arrêter la session précédente
        if (currentSessionId && currentSessionId !== sessionId) {
          await stopSession()
        }

        // Récupérer la position de reprise si disponible
        const progress = sessionProgress.find(p => p.sessionId === sessionId)
        const startPosition = progress?.lastPosition || 0

        // Track meditation started
        const session = MEDITATION_SESSIONS.find(s => s.id === sessionId)
        analytics.trackMeditation('started', session?.theme || 'unknown')

        set({
          currentSessionId: sessionId,
          currentStatus: 'playing',
          currentPosition: startPosition,
        })

        await meditationTTSService.playAudio(sessionId, (status) => {
          if (status.isLoaded) {
            if ('positionMillis' in status) {
              set({ currentPosition: status.positionMillis || 0 })
            }
            if ('durationMillis' in status && status.durationMillis) {
              set({ duration: status.durationMillis })
            }
            if ('didJustFinish' in status && status.didJustFinish) {
              get().markSessionCompleted(sessionId)
              set({ currentStatus: 'idle', currentPosition: 0 })
            }
          }
        })

        // Si on doit reprendre à une position
        if (startPosition > 0) {
          await meditationTTSService.seekTo(startPosition)
        }
      },

      pauseSession: async () => {
        await meditationTTSService.pauseAudio()
        set({ currentStatus: 'paused' })

        // Sauvegarder la position
        const { currentSessionId, currentPosition } = get()
        if (currentSessionId) {
          get().updateProgress(currentSessionId, currentPosition)
        }
      },

      resumeSession: async () => {
        await meditationTTSService.resumeAudio()
        set({ currentStatus: 'playing' })
      },

      stopSession: async () => {
        const { currentSessionId, currentPosition } = get()

        // Sauvegarder la position avant d'arrêter
        if (currentSessionId) {
          get().updateProgress(currentSessionId, currentPosition)
        }

        await meditationTTSService.stopAudio()
        set({
          currentSessionId: null,
          currentStatus: 'idle',
          currentPosition: 0,
        })
      },

      seekTo: async (position) => {
        await meditationTTSService.seekTo(position)
        set({ currentPosition: position })
      },

      updateProgress: (sessionId, position, completed = false) => {
        const { sessionProgress, totalMeditationMinutes } = get()
        const existingProgress = sessionProgress.find(p => p.sessionId === sessionId)

        const now = new Date().toISOString()
        const additionalTime = position - (existingProgress?.lastPosition || 0)

        if (existingProgress) {
          set({
            sessionProgress: sessionProgress.map(p =>
              p.sessionId === sessionId
                ? {
                    ...p,
                    lastPosition: completed ? 0 : position,
                    totalListenTime: p.totalListenTime + Math.max(0, additionalTime),
                    completedAt: completed ? now : p.completedAt,
                    listenCount: completed ? p.listenCount + 1 : p.listenCount,
                  }
                : p
            ),
            totalMeditationMinutes: totalMeditationMinutes + Math.max(0, additionalTime / 60000),
          })
        } else {
          set({
            sessionProgress: [
              ...sessionProgress,
              {
                sessionId,
                completedAt: completed ? now : null,
                listenCount: completed ? 1 : 0,
                lastPosition: completed ? 0 : position,
                totalListenTime: Math.max(0, position),
              },
            ],
            totalMeditationMinutes: totalMeditationMinutes + Math.max(0, position / 60000),
          })
        }
      },

      getSessionProgress: (sessionId) => {
        return get().sessionProgress.find(p => p.sessionId === sessionId) || null
      },

      markSessionCompleted: (sessionId) => {
        const { sessionsCompleted, currentStreak, longestStreak, lastMeditationDate } = get()
        const today = getDateString()

        // Calculer le streak
        let newStreak = currentStreak
        if (lastMeditationDate) {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().split('T')[0]

          if (lastMeditationDate === today) {
            // Déjà médité aujourd'hui, pas de changement
          } else if (lastMeditationDate === yesterdayStr) {
            newStreak = currentStreak + 1
          } else {
            newStreak = 1
          }
        } else {
          newStreak = 1
        }

        get().updateProgress(sessionId, 0, true)

        const newSessionsCompleted = sessionsCompleted + 1

        set({
          sessionsCompleted: newSessionsCompleted,
          currentStreak: newStreak,
          longestStreak: Math.max(longestStreak, newStreak),
          lastMeditationDate: today,
        })

        // Gamification: ajouter XP et mettre à jour les métriques
        const gamification = useGamificationStore.getState()

        // XP pour la session complétée
        gamification.addXP(XP_REWARDS.MEDITATION_SESSION_COMPLETED, 'meditation_session')

        // Bonus première session
        if (newSessionsCompleted === 1) {
          gamification.addXP(XP_REWARDS.MEDITATION_FIRST_SESSION, 'meditation_first')
        }

        // Bonus programme complet (8 sessions)
        if (newSessionsCompleted === 8) {
          gamification.addXP(XP_REWARDS.MEDITATION_PROGRAM_COMPLETED, 'meditation_complete')
        }

        // Incrémenter la métrique pour les achievements
        gamification.incrementMetric('meditation_sessions')

        // Track meditation completed in analytics
        const session = MEDITATION_SESSIONS.find(s => s.id === sessionId)
        const progress = get().sessionProgress.find(p => p.sessionId === sessionId)
        analytics.trackMeditation('completed', session?.theme || 'unknown', progress?.totalListenTime)
      },

      setStatus: (status) => set({ currentStatus: status }),
      setPosition: (position) => set({ currentPosition: position }),
      setDuration: (duration) => set({ duration }),

      clearCache: async () => {
        await meditationTTSService.clearCache()
        set({
          cachedSessions: MEDITATION_SESSIONS.map(s => ({
            sessionId: s.id,
            isCached: false,
            cachedAt: null,
          })),
        })
      },

      getCacheSize: async () => {
        return meditationTTSService.getCacheSize()
      },

      getUnlockedSessions: (currentWeek) => {
        // Les sessions sont débloquées selon la semaine du programme
        return MEDITATION_SESSIONS.filter(s => s.week <= currentWeek)
      },

      getNextSession: () => {
        const { sessionProgress } = get()

        // Trouver la première session non complétée
        for (const session of MEDITATION_SESSIONS) {
          const progress = sessionProgress.find(p => p.sessionId === session.id)
          if (!progress?.completedAt) {
            return session
          }
        }

        // Si tout est complété, retourner la dernière session
        return MEDITATION_SESSIONS[MEDITATION_SESSIONS.length - 1]
      },
    }),
    {
      name: 'meditation-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessionProgress: state.sessionProgress,
        totalMeditationMinutes: state.totalMeditationMinutes,
        sessionsCompleted: state.sessionsCompleted,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        lastMeditationDate: state.lastMeditationDate,
        cachedSessions: state.cachedSessions,
      }),
    }
  )
)

export default useMeditationStore
