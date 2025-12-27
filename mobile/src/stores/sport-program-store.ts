import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SportPhase, WeeklyProgram, GeneratedSession, SessionFeedback } from '../types'
import { useGamificationStore, XP_REWARDS } from './gamification-store'

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

interface SportProgramState {
  // Current state
  currentPhase: SportPhase
  currentWeek: number
  startDate: string | null
  isActive: boolean

  // Programs
  weeklyPrograms: WeeklyProgram[]
  currentProgramId: string | null

  // Stats
  completedSessions: number
  totalSessionsGenerated: number
  streak: number
  lastSessionDate: string | null

  // Feedbacks
  sessionFeedbacks: SessionFeedback[]

  // Computed properties (for widget compatibility)
  currentProgram: WeeklyProgram | null
  currentStreak: number
  totalSessionsCompleted: number

  // Actions
  startProgram: () => void
  pauseProgram: () => void
  resumeProgram: () => void
  setCurrentProgram: (program: WeeklyProgram) => void
  completeSession: (sessionId: string, feedback?: Partial<SessionFeedback>) => void
  submitFeedback: (feedback: SessionFeedback) => void
  advancePhase: () => void
  advanceWeek: () => void
  setPhase: (phase: SportPhase) => void

  // Getters
  getCurrentProgram: () => WeeklyProgram | null
  getTodaySession: () => GeneratedSession | null
  getSessionById: (sessionId: string) => GeneratedSession | null
  getPhaseProgress: () => { current: number; total: number; percentage: number; phase: SportPhase; progress: number }
  getWeeklyProgress: () => { completed: number; total: number }
}

const PHASE_DURATIONS: Record<SportPhase, number> = {
  discovery: 2,
  walking: 4,
  resistance_intro: 4,
  full_program: 12,
}

const PHASE_ORDER: SportPhase[] = ['discovery', 'walking', 'resistance_intro', 'full_program']

export const useSportProgramStore = create<SportProgramState>()(
  persist(
    (set, get) => ({
      currentPhase: 'discovery',
      currentWeek: 1,
      startDate: null,
      isActive: false,
      weeklyPrograms: [],
      currentProgramId: null,
      completedSessions: 0,
      totalSessionsGenerated: 0,
      streak: 0,
      lastSessionDate: null,
      sessionFeedbacks: [],

      // Computed properties (getters)
      get currentProgram() {
        const { currentProgramId, weeklyPrograms } = get()
        if (!currentProgramId) return null
        return weeklyPrograms.find(p => p.id === currentProgramId) || null
      },
      get currentStreak() {
        return get().streak
      },
      get totalSessionsCompleted() {
        return get().completedSessions
      },

      startProgram: () => {
        set({
          isActive: true,
          startDate: getTodayString(),
          currentPhase: 'discovery',
          currentWeek: 1,
        })
      },

      pauseProgram: () => {
        set({ isActive: false })
      },

      resumeProgram: () => {
        set({ isActive: true })
      },

      setCurrentProgram: (program) => {
        set((state) => ({
          weeklyPrograms: [...state.weeklyPrograms.filter(p => p.id !== program.id), program],
          currentProgramId: program.id,
          totalSessionsGenerated: state.totalSessionsGenerated + program.sessions.length,
        }))
      },

      completeSession: (sessionId, feedback) => {
        const today = getTodayString()

        set((state) => {
          // Find and update the session
          const updatedPrograms = state.weeklyPrograms.map(program => ({
            ...program,
            sessions: program.sessions.map(session =>
              session.id === sessionId
                ? { ...session, isCompleted: true, feedback: feedback as SessionFeedback }
                : session
            ),
          }))

          // Calculate streak
          let newStreak = state.streak
          if (state.lastSessionDate) {
            const lastDate = new Date(state.lastSessionDate)
            const todayDate = new Date(today)
            const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

            if (diffDays === 1) {
              newStreak++
            } else if (diffDays > 1) {
              newStreak = 1
            }
          } else {
            newStreak = 1
          }

          return {
            weeklyPrograms: updatedPrograms,
            completedSessions: state.completedSessions + 1,
            lastSessionDate: today,
            streak: newStreak,
          }
        })

        // Gamification
        const gamification = useGamificationStore.getState()
        gamification.addXP(XP_REWARDS.COMPLETE_SESSION, 'Seance completee')
        gamification.incrementMetric('sessions_completed')
        gamification.checkAndUpdateStreak()

        // Check for streak XP
        const { streak } = get()
        if (streak === 7) {
          gamification.addXP(XP_REWARDS.SPORT_STREAK_DAY * 7, 'Serie sport 7 jours')
        }
      },

      submitFeedback: (feedback) => {
        set((state) => ({
          sessionFeedbacks: [...state.sessionFeedbacks, feedback],
        }))

        const gamification = useGamificationStore.getState()
        gamification.addXP(XP_REWARDS.GIVE_SESSION_FEEDBACK, 'Feedback donne')
        gamification.incrementMetric('session_feedbacks')
      },

      advancePhase: () => {
        const { currentPhase } = get()
        const currentIndex = PHASE_ORDER.indexOf(currentPhase)

        if (currentIndex < PHASE_ORDER.length - 1) {
          const nextPhase = PHASE_ORDER[currentIndex + 1]
          set({
            currentPhase: nextPhase,
            currentWeek: 1,
          })

          const gamification = useGamificationStore.getState()
          gamification.addXP(XP_REWARDS.COMPLETE_PHASE, 'Phase completee')
          gamification.incrementMetric('phases_completed')
        }
      },

      advanceWeek: () => {
        const { currentWeek, currentPhase } = get()
        const maxWeeks = PHASE_DURATIONS[currentPhase]

        if (currentWeek >= maxWeeks) {
          get().advancePhase()
        } else {
          set({ currentWeek: currentWeek + 1 })
        }
      },

      setPhase: (phase) => {
        set({
          currentPhase: phase,
          currentWeek: 1,
        })
      },

      getCurrentProgram: () => {
        const { currentProgramId, weeklyPrograms } = get()
        if (!currentProgramId) return null
        return weeklyPrograms.find(p => p.id === currentProgramId) || null
      },

      getTodaySession: () => {
        const program = get().getCurrentProgram()
        if (!program) return null

        const today = getTodayString()
        const todayDayOfWeek = new Date().getDay()

        return program.sessions.find(
          s => !s.isCompleted && s.dayOfWeek === todayDayOfWeek
        ) || null
      },

      getSessionById: (sessionId) => {
        const { weeklyPrograms } = get()
        for (const program of weeklyPrograms) {
          const session = program.sessions.find(s => s.id === sessionId)
          if (session) return session
        }
        return null
      },

      getPhaseProgress: () => {
        const { currentPhase, currentWeek } = get()
        const total = PHASE_DURATIONS[currentPhase]
        const current = currentWeek
        const percentage = (current / total) * 100
        const progress = percentage // Alias for compatibility

        return { current, total, percentage, phase: currentPhase, progress }
      },

      getWeeklyProgress: () => {
        const program = get().getCurrentProgram()
        if (!program) return { completed: 0, total: 0 }

        const completed = program.sessions.filter(s => s.isCompleted).length
        const total = program.sessions.length

        return { completed, total }
      },
    }),
    {
      name: 'presence-sport-program',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentPhase: state.currentPhase,
        currentWeek: state.currentWeek,
        startDate: state.startDate,
        isActive: state.isActive,
        weeklyPrograms: state.weeklyPrograms,
        currentProgramId: state.currentProgramId,
        completedSessions: state.completedSessions,
        totalSessionsGenerated: state.totalSessionsGenerated,
        streak: state.streak,
        lastSessionDate: state.lastSessionDate,
        sessionFeedbacks: state.sessionFeedbacks,
      }),
    }
  )
)

export default useSportProgramStore
