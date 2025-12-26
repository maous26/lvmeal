'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Play,
  Sparkles,
  Calendar,
  TrendingUp,
  Dumbbell,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  Clock,
  Zap,
  Trophy,
  Flame,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Badge } from '@/components/ui/badge'
import { SportSession } from '@/components/sport/sport-session'
import { SessionFeedbackModal } from '@/components/sport/session-feedback'
import { useSportProgramStore } from '@/stores/sport-program-store'
import { useUserStore } from '@/stores/user-store'
import { generateWeeklyProgram } from '@/app/actions/sport-program'
import { cn } from '@/lib/utils'
import type { GeneratedSession, SessionFeedback, ProgramGenerationContext } from '@/types/sport'

const phaseLabels = {
  discovery: 'Découverte',
  walking_program: 'Programme Marche',
  resistance_intro: 'Intro Musculation',
  full_program: 'Programme Complet',
}

const phaseDescriptions = {
  discovery: 'Étirements, mobilité, découverte de ton corps',
  walking_program: 'Développer l\'habitude de marcher régulièrement',
  resistance_intro: 'Découvrir le renforcement musculaire en douceur',
  full_program: 'Programme sportif complet et personnalisé',
}

const phaseIcons = {
  discovery: Sparkles,
  walking_program: Activity,
  resistance_intro: Dumbbell,
  full_program: Zap,
}

export default function SportPage() {
  const [mounted, setMounted] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [activeSession, setActiveSession] = React.useState<GeneratedSession | null>(null)
  const [feedbackSession, setFeedbackSession] = React.useState<GeneratedSession | null>(null)

  const { profile, updateProfile } = useUserStore()
  const {
    currentProgram,
    currentPhase,
    weekInPhase,
    totalSessionsCompleted,
    currentStreak,
    longestStreak,
    allFeedbacks,
    preferredExercises,
    avoidedExercises,
    setCurrentProgram,
    markSessionCompleted,
    addSessionFeedback,
    getPhaseProgress,
    needsNewProgram,
  } = useSportProgramStore()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isSportEnabled = profile?.sportTrackingEnabled || profile?.metabolismProfile === 'adaptive'

  const handleActivateSport = () => {
    updateProfile({ sportTrackingEnabled: true })
  }

  const handleGenerateProgram = async () => {
    if (!profile) return

    setIsGenerating(true)
    try {
      const context: ProgramGenerationContext = {
        metabolismProfile: profile.metabolismProfile || 'standard',
        age: profile.age || 30,
        weight: profile.weight || 70,
        height: profile.height || 170,
        gender: profile.gender || 'other',
        fitnessLevel: 'beginner',
        goal: profile.goal || 'health',
        currentPhase,
        weekInPhase,
        completedWeeks: currentProgram ? 1 : 0,
        recentFeedbacks: allFeedbacks.slice(-10),
        weightHistory: [],
        completedSessions: totalSessionsCompleted,
        missedSessions: 0,
        availableEquipment: ['none', 'yoga_mat'],
        preferredSessionDuration: 20,
        availableDaysPerWeek: [1, 3, 5],
        dislikedExercises: avoidedExercises,
        likedExercises: preferredExercises,
      }

      const newProgram = await generateWeeklyProgram(profile, context)
      if (newProgram) {
        setCurrentProgram(newProgram)
      }
    } catch (error) {
      console.error('Error generating program:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartSession = (session: GeneratedSession) => {
    setActiveSession(session)
  }

  const handleSessionComplete = () => {
    if (activeSession) {
      markSessionCompleted(activeSession.id)
      setFeedbackSession(activeSession)
      setActiveSession(null)
    }
  }

  const handleFeedbackSubmit = (feedback: Omit<SessionFeedback, 'sessionId' | 'date'>) => {
    if (feedbackSession) {
      addSessionFeedback(feedbackSession.id, feedback)
      setFeedbackSession(null)
    }
  }

  if (!mounted) {
    return (
      <>
        <Header title="Sport" showBack />
        <PageContainer>
          <Section>
            <div className="animate-pulse bg-[var(--bg-secondary)] h-48 rounded-xl" />
          </Section>
        </PageContainer>
      </>
    )
  }

  // Active session view
  if (activeSession) {
    return (
      <SportSession
        session={activeSession}
        onComplete={handleSessionComplete}
        onBack={() => setActiveSession(null)}
      />
    )
  }

  // Sport not enabled
  if (!isSportEnabled) {
    return (
      <>
        <Header title="Sport" showBack />
        <PageContainer>
          <Section>
            <Card padding="lg">
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-violet-500" />
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                  Programme Sport LymIA
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs mx-auto">
                  LymIA crée un programme sportif 100% personnalisé, adapté à ton niveau et tes objectifs. Progression douce garantie !
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <Dumbbell className="h-5 w-5 text-violet-500 mb-2" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">Séances guidées</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Exercices expliqués pas à pas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <TrendingUp className="h-5 w-5 text-emerald-500 mb-2" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">Progression</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Adapté à ton feedback</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <Sparkles className="h-5 w-5 text-amber-500 mb-2" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">IA Coach</p>
                    <p className="text-xs text-[var(--text-tertiary)]">LymIA t'encourage</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <Trophy className="h-5 w-5 text-orange-500 mb-2" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">Défis</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Gagne des badges</p>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full h-14"
                  onClick={handleActivateSport}
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Activer le programme LymIA
                </Button>
              </div>
            </Card>
          </Section>
        </PageContainer>
      </>
    )
  }

  // Main sport page with program
  const phaseProgress = getPhaseProgress()
  const PhaseIcon = phaseIcons[phaseProgress.phase]

  // Get today's session
  const today = new Date().getDay()
  const todaySession = currentProgram?.sessions.find(
    (s) => s.dayOfWeek === today && !s.isCompleted
  )

  // Weekly stats
  const completedSessions = currentProgram?.sessions.filter((s) => s.isCompleted).length || 0
  const totalSessions = currentProgram?.sessions.length || 0
  const weeklyProgress = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

  return (
    <>
      <Header title="Programme Sport" showBack />

      <PageContainer>
        {/* LymIA Coach Banner */}
        <Section>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 border border-violet-500/30"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                    LymIA Coach
                  </p>
                  <Badge variant="outline" size="sm" className="text-[10px] border-violet-500/30 text-violet-600">
                    Actif
                  </Badge>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {currentProgram?.motivationalMessage || 'Prêt à bouger ? Je t\'ai préparé un super programme !'}
                </p>
              </div>
            </div>
          </motion.div>
        </Section>

        {/* Phase Progress */}
        <Section>
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <PhaseIcon className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">
                    {phaseLabels[phaseProgress.phase]}
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Semaine {phaseProgress.weekInPhase}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-emerald-500">
                  {Math.round(phaseProgress.progress)}%
                </span>
              </div>
            </div>

            <ProgressBar
              value={phaseProgress.progress}
              max={100}
              color="var(--success)"
              size="md"
            />

            <p className="text-xs text-[var(--text-tertiary)] mt-3">
              {phaseDescriptions[phaseProgress.phase]}
            </p>
          </Card>
        </Section>

        {/* Today's Session CTA */}
        {todaySession && (
          <Section>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card
                padding="default"
                className="border-2 border-violet-500/30 bg-gradient-to-r from-violet-500/5 to-purple-500/5 cursor-pointer"
                onClick={() => handleStartSession(todaySession)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Play className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-violet-500 font-medium">Séance du jour</p>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {todaySession.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {todaySession.duration} min
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                          <Dumbbell className="h-3 w-3" />
                          {todaySession.exercises.length} exercices
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-6 w-6 text-violet-500" />
                </div>
              </Card>
            </motion.div>
          </Section>
        )}

        {/* No program - Generate one */}
        {!currentProgram && (
          <Section>
            <Card padding="lg" className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-violet-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Pas encore de programme
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                LymIA va créer ton programme personnalisé pour cette semaine
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={handleGenerateProgram}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    LymIA réfléchit...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Générer mon programme
                  </>
                )}
              </Button>
            </Card>
          </Section>
        )}

        {/* Stats Grid */}
        <Section>
          <div className="grid grid-cols-3 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card padding="default" className="text-center">
                <Trophy className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {totalSessionsCompleted}
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Séances</p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card padding="default" className="text-center">
                <span className="text-xl">🔥</span>
                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {currentStreak}
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Série</p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card padding="default" className="text-center">
                <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {Math.round(phaseProgress.progress)}%
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)]">Phase</p>
              </Card>
            </motion.div>
          </div>
        </Section>

        {/* Weekly Program */}
        {currentProgram && (
          <Section>
            <Card padding="default">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--text-tertiary)]" />
                  <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                    Semaine en cours
                  </h3>
                </div>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {completedSessions}/{totalSessions} séances
                </span>
              </div>

              <ProgressBar
                value={weeklyProgress}
                max={100}
                color="var(--accent-primary)"
                size="md"
              />

              {/* Session list */}
              <div className="mt-4 space-y-2">
                {currentProgram.sessions.map((session) => {
                  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
                  const isToday = session.dayOfWeek === today
                  const isPast = session.dayOfWeek < today && !session.isCompleted

                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all',
                        session.isCompleted
                          ? 'bg-emerald-500/10'
                          : isToday
                          ? 'bg-violet-500/10 border border-violet-500/30'
                          : isPast
                          ? 'bg-[var(--bg-secondary)] opacity-50'
                          : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
                      )}
                      onClick={() => !session.isCompleted && handleStartSession(session)}
                    >
                      {session.isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      ) : isToday ? (
                        <Play className="h-5 w-5 text-violet-500 flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-[var(--border-default)] flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            session.isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isToday
                              ? 'text-violet-600 dark:text-violet-400'
                              : 'text-[var(--text-primary)]'
                          )}
                        >
                          {session.title}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {session.duration} min • {session.exercises.length} exercices
                        </p>
                      </div>
                      <span className={cn(
                        'text-xs font-medium',
                        isToday ? 'text-violet-500' : 'text-[var(--text-tertiary)]'
                      )}>
                        {dayNames[session.dayOfWeek]}
                      </span>
                    </motion.div>
                  )
                })}
              </div>

              {/* Regenerate button */}
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={handleGenerateProgram}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Régénérer le programme
              </Button>
            </Card>
          </Section>
        )}

        {/* LymIA Adaptations Info */}
        {currentProgram?.adaptations && currentProgram.adaptations.length > 0 && (
          <Section>
            <Card padding="default" className="bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">
                    Adaptations LymIA
                  </p>
                  <ul className="space-y-1">
                    {currentProgram.adaptations.map((adaptation, i) => (
                      <li key={i} className="text-xs text-[var(--text-secondary)]">
                        • {adaptation}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </Section>
        )}

        <div className="h-8" />
      </PageContainer>

      {/* Feedback Modal */}
      <AnimatePresence>
        {feedbackSession && (
          <SessionFeedbackModal
            session={feedbackSession}
            isOpen={!!feedbackSession}
            onClose={() => setFeedbackSession(null)}
            onSubmit={handleFeedbackSubmit}
          />
        )}
      </AnimatePresence>
    </>
  )
}
