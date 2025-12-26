import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  WeeklyProgram,
  GeneratedSession,
  SessionFeedback,
  SportProgramState,
} from '@/types/sport'
import type { ActivityPhase } from '@/types/user'
import { useGamificationStore, XP_REWARDS } from './gamification-store'

// Helper to get today's date string
function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

// Helper to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

interface SportProgramStore extends SportProgramState {
  // Actions - Program
  setCurrentProgram: (program: WeeklyProgram) => void
  markSessionCompleted: (sessionId: string) => void
  addSessionFeedback: (sessionId: string, feedback: Omit<SessionFeedback, 'sessionId' | 'date'>) => void

  // Actions - Session
  startSession: (sessionId: string) => void
  endSession: () => void

  // Actions - Stats
  updateStats: () => void
  getPhaseProgress: () => { phase: ActivityPhase; weekInPhase: number; progress: number }
  canProgressToNextPhase: () => boolean
  advanceToNextPhase: () => void

  // Actions - Preferences
  addPreferredExercise: (exerciseId: string) => void
  addAvoidedExercise: (exerciseId: string) => void

  // Actions - Generation trigger
  needsNewProgram: () => boolean
  getProgramGenerationContext: () => ProgramContext | null
}

interface ProgramContext {
  currentPhase: ActivityPhase
  weekInPhase: number
  completedWeeks: number
  recentFeedbacks: SessionFeedback[]
  completedSessions: number
  missedSessions: number
  preferredExercises: string[]
  avoidedExercises: string[]
}

// Extended state for LymIA Sport Program
interface ExtendedSportState extends SportProgramState {
  currentPhase: ActivityPhase
  weekInPhase: number
  allFeedbacks: SessionFeedback[]
}

export const useSportProgramStore = create<SportProgramStore & ExtendedSportState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentProgram: null,
      pastPrograms: [],
      currentSession: null,
      totalSessionsCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageSessionDuration: 0,
      preferredExercises: [],
      avoidedExercises: [],
      isGenerating: false,
      error: null,
      currentPhase: 'discovery' as ActivityPhase,
      weekInPhase: 1,
      allFeedbacks: [],

      // Actions - Program
      setCurrentProgram: (program) => {
        const { currentProgram, pastPrograms } = get()

        // Archive current program if exists
        const newPastPrograms = currentProgram
          ? [...pastPrograms, currentProgram].slice(-12) // Keep last 12 weeks
          : pastPrograms

        set({
          currentProgram: program,
          pastPrograms: newPastPrograms,
        })
      },

      markSessionCompleted: (sessionId) => {
        const { currentProgram } = get()
        if (!currentProgram) return

        const gamification = useGamificationStore.getState()

        const updatedSessions = currentProgram.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, isCompleted: true, completedAt: new Date().toISOString() }
            : session
        )

        const completedCount = updatedSessions.filter((s) => s.isCompleted).length
        const completionRate = Math.round((completedCount / updatedSessions.length) * 100)
        const newTotal = get().totalSessionsCompleted + 1

        set({
          currentProgram: {
            ...currentProgram,
            sessions: updatedSessions,
            completionRate,
          },
          totalSessionsCompleted: newTotal,
        })

        // Gamification: XP for completing session
        gamification.addXP(XP_REWARDS.COMPLETE_SESSION, 'Seance completee')
        gamification.incrementMetric('sessions_completed')
        gamification.incrementMetric('sport_streak')

        // Update streak
        get().updateStats()
      },

      addSessionFeedback: (sessionId, feedback) => {
        const { currentProgram, allFeedbacks, preferredExercises, avoidedExercises } = get()
        if (!currentProgram) return

        const gamification = useGamificationStore.getState()

        const fullFeedback: SessionFeedback = {
          ...feedback,
          sessionId,
          date: getTodayString(),
        }

        // Update session with feedback
        const updatedSessions = currentProgram.sessions.map((session) =>
          session.id === sessionId ? { ...session, feedback: fullFeedback } : session
        )

        // Update preferred/avoided exercises
        const newPreferred = [...preferredExercises]
        const newAvoided = [...avoidedExercises]

        feedback.likedExercises.forEach((ex) => {
          if (!newPreferred.includes(ex)) newPreferred.push(ex)
          const avoidedIndex = newAvoided.indexOf(ex)
          if (avoidedIndex > -1) newAvoided.splice(avoidedIndex, 1)
        })

        feedback.dislikedExercises.forEach((ex) => {
          if (!newAvoided.includes(ex)) newAvoided.push(ex)
          const preferredIndex = newPreferred.indexOf(ex)
          if (preferredIndex > -1) newPreferred.splice(preferredIndex, 1)
        })

        set({
          currentProgram: { ...currentProgram, sessions: updatedSessions },
          allFeedbacks: [...allFeedbacks, fullFeedback].slice(-50), // Keep last 50
          preferredExercises: newPreferred.slice(-20),
          avoidedExercises: newAvoided.slice(-20),
        })

        // Gamification: XP for giving feedback
        gamification.addXP(XP_REWARDS.GIVE_SESSION_FEEDBACK, 'Feedback de seance')
        gamification.incrementMetric('session_feedbacks')
      },

      // Actions - Session
      startSession: (sessionId) => {
        const { currentProgram } = get()
        if (!currentProgram) return

        const session = currentProgram.sessions.find((s) => s.id === sessionId)
        if (session) {
          set({ currentSession: session })
        }
      },

      endSession: () => {
        set({ currentSession: null })
      },

      // Actions - Stats
      updateStats: () => {
        const { pastPrograms, currentProgram, totalSessionsCompleted } = get()

        // Calculate streak
        const allPrograms = currentProgram ? [...pastPrograms, currentProgram] : pastPrograms
        let streak = 0
        const today = new Date()

        for (let i = 0; i < 365; i++) {
          const date = new Date(today)
          date.setDate(today.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]

          // Check if there was a completed session on this date
          const hadSession = allPrograms.some((program) =>
            program.sessions.some(
              (session) =>
                session.isCompleted &&
                session.completedAt?.split('T')[0] === dateStr
            )
          )

          // For streak, we only count days where sessions were scheduled
          const wasScheduled = allPrograms.some((program) => {
            const programStart = new Date(program.startDate)
            const programEnd = new Date(program.endDate)
            return date >= programStart && date <= programEnd
          })

          if (wasScheduled) {
            if (hadSession) {
              streak++
            } else if (i > 0) {
              // Break streak if missed a day (except today)
              break
            }
          }
        }

        const { longestStreak } = get()

        set({
          currentStreak: streak,
          longestStreak: Math.max(longestStreak, streak),
        })
      },

      getPhaseProgress: () => {
        const { currentPhase, weekInPhase } = get()

        // Calculate progress within phase
        const phaseMinWeeks: Record<ActivityPhase, number> = {
          discovery: 2,
          walking_program: 3,
          resistance_intro: 4,
          full_program: 0, // Ongoing
        }

        const minWeeks = phaseMinWeeks[currentPhase]
        const progress = minWeeks > 0 ? Math.min(100, (weekInPhase / minWeeks) * 100) : 100

        return { phase: currentPhase, weekInPhase, progress }
      },

      canProgressToNextPhase: () => {
        const { currentPhase, weekInPhase, currentProgram, allFeedbacks } = get()

        if (currentPhase === 'full_program') return false

        const minWeeks: Record<Exclude<ActivityPhase, 'full_program'>, number> = {
          discovery: 2,
          walking_program: 3,
          resistance_intro: 4,
        }

        if (weekInPhase < minWeeks[currentPhase as keyof typeof minWeeks]) return false

        // Check completion rate
        if (currentProgram) {
          const completionRate = currentProgram.completionRate || 0
          if (completionRate < 70) return false
        }

        // Check average feeling from recent feedbacks
        const recentFeedbacks = allFeedbacks.slice(-10)
        if (recentFeedbacks.length >= 3) {
          const avgFeeling =
            recentFeedbacks.reduce((sum, f) => sum + f.overallFeeling, 0) /
            recentFeedbacks.length
          if (avgFeeling < 3) return false
        }

        // Check for pain reports
        const hasPainReported = recentFeedbacks.some(
          (f) => f.painOrDiscomfort && f.painOrDiscomfort.length > 0
        )
        if (hasPainReported) return false

        return true
      },

      advanceToNextPhase: () => {
        const { currentPhase } = get()
        const gamification = useGamificationStore.getState()

        const nextPhaseMap: Record<ActivityPhase, ActivityPhase | null> = {
          discovery: 'walking_program',
          walking_program: 'resistance_intro',
          resistance_intro: 'full_program',
          full_program: null,
        }

        const nextPhase = nextPhaseMap[currentPhase]
        if (nextPhase) {
          set({
            currentPhase: nextPhase,
            weekInPhase: 1,
          })

          // Gamification: XP for completing a phase
          gamification.addXP(XP_REWARDS.COMPLETE_PHASE, 'Phase completee')
        }
      },

      // Actions - Preferences
      addPreferredExercise: (exerciseId) => {
        const { preferredExercises, avoidedExercises } = get()
        if (!preferredExercises.includes(exerciseId)) {
          set({
            preferredExercises: [...preferredExercises, exerciseId].slice(-20),
            avoidedExercises: avoidedExercises.filter((id) => id !== exerciseId),
          })
        }
      },

      addAvoidedExercise: (exerciseId) => {
        const { avoidedExercises, preferredExercises } = get()
        if (!avoidedExercises.includes(exerciseId)) {
          set({
            avoidedExercises: [...avoidedExercises, exerciseId].slice(-20),
            preferredExercises: preferredExercises.filter((id) => id !== exerciseId),
          })
        }
      },

      // Actions - Generation
      needsNewProgram: () => {
        const { currentProgram } = get()
        if (!currentProgram) return true

        const endDate = new Date(currentProgram.endDate)
        const today = new Date()

        // Need new program if current one ended
        return today > endDate
      },

      getProgramGenerationContext: (): ProgramContext | null => {
        const {
          currentPhase,
          weekInPhase,
          pastPrograms,
          allFeedbacks,
          totalSessionsCompleted,
          preferredExercises,
          avoidedExercises,
        } = get()

        // Calculate completed weeks
        const completedWeeks = pastPrograms.length

        // Calculate missed sessions
        const totalScheduled = pastPrograms.reduce(
          (sum, p) => sum + p.sessions.length,
          0
        )
        const missedSessions = totalScheduled - totalSessionsCompleted

        return {
          currentPhase,
          weekInPhase,
          completedWeeks,
          recentFeedbacks: allFeedbacks.slice(-10),
          completedSessions: totalSessionsCompleted,
          missedSessions: Math.max(0, missedSessions),
          preferredExercises,
          avoidedExercises,
        }
      },
    }),
    {
      name: 'presence-sport-program',
      partialize: (state) => ({
        currentProgram: state.currentProgram,
        pastPrograms: state.pastPrograms,
        totalSessionsCompleted: state.totalSessionsCompleted,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        preferredExercises: state.preferredExercises,
        avoidedExercises: state.avoidedExercises,
        currentPhase: state.currentPhase,
        weekInPhase: state.weekInPhase,
        allFeedbacks: state.allFeedbacks,
      }),
    }
  )
)
