'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Settings,
  Bell,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  ChevronDown,
  Scale,
  Target,
  Utensils,
  Activity,
  Heart,
  Moon,
  Droplets,
  Brain,
  Dumbbell,
  Flame,
  Pencil,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage, getInitials } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StreakBadge, XPDisplay } from '@/components/dashboard/streak-badge'
import { useGamificationStore } from '@/stores/gamification-store'
import { useUserStore } from '@/stores/user-store'
import { formatNumber, cn } from '@/lib/utils'
import type { UserProfile, DietType, ReligiousDiet, MetabolismProfile, ActivityLevel, Goal } from '@/types'

// Helper functions for display labels
const getDietLabel = (diet?: DietType): string => {
  const labels: Record<DietType, string> = {
    omnivore: 'Omnivore',
    vegetarian: 'Vegetarien',
    vegan: 'Vegan',
    pescatarian: 'Pescetarien',
    keto: 'Keto',
    paleo: 'Paleo',
  }
  return diet ? labels[diet] : 'Non defini'
}

const getReligiousDietLabel = (diet?: ReligiousDiet): string | null => {
  if (!diet) return null
  const labels: Record<NonNullable<ReligiousDiet>, string> = {
    halal: 'Halal',
    casher: 'Casher',
  }
  return labels[diet]
}

const getActivityLabel = (level?: ActivityLevel): string => {
  const labels: Record<ActivityLevel, string> = {
    sedentary: 'Sedentaire',
    light: 'Leger',
    moderate: 'Modere',
    active: 'Actif',
    athlete: 'Athlete',
  }
  return level ? labels[level] : 'Non defini'
}

const getGoalLabel = (goal?: Goal): string => {
  const labels: Record<Goal, string> = {
    weight_loss: 'Perte de poids',
    muscle_gain: 'Prise de muscle',
    maintenance: 'Maintien',
    health: 'Sante',
    energy: 'Energie',
  }
  return goal ? labels[goal] : 'Non defini'
}

const getMetabolismLabel = (profile?: MetabolismProfile): { label: string; description: string } => {
  if (profile === 'adaptive') {
    return {
      label: 'Approche bienveillante',
      description: 'Programme progressif et adapte',
    }
  }
  return {
    label: 'Standard',
    description: 'Approche classique',
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)
  const [expandedSection, setExpandedSection] = React.useState<string | null>(null)

  // User store (primary source of profile data)
  const { profile: storeProfile, clearProfile, migrateFromLocalStorage } = useUserStore()

  // Gamification store
  const {
    totalXP,
    currentLevel,
    getXPForNextLevel,
    getStreakInfo,
    checkAndUpdateStreak,
  } = useGamificationStore()

  // Use store profile, fallback to localStorage for backward compatibility
  const [profile, setProfile] = React.useState<Partial<UserProfile> | null>(null)

  React.useEffect(() => {
    setMounted(true)
    checkAndUpdateStreak()
    // Migrate legacy localStorage to store if needed
    migrateFromLocalStorage()
  }, [checkAndUpdateStreak, migrateFromLocalStorage])

  // Separate effect to handle profile update
  React.useEffect(() => {
    if (storeProfile) {
      setProfile(storeProfile)
    }
  }, [storeProfile])

  const handleLogout = () => {
    // Clear both stores
    clearProfile()
    localStorage.removeItem('userProfile')
    router.push('/onboarding')
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  // Get real gamification data after hydration
  const streakInfo = mounted ? getStreakInfo() : { current: 0, longest: 0, isActive: false }
  const xpForNextLevel = mounted ? getXPForNextLevel() : 100

  if (!profile || !mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  return (
    <>
      <Header title="Profil" />

      <PageContainer>
        {/* Profile header */}
        <Section>
          <Card padding="lg">
            <div className="flex items-center gap-4">
              <Avatar size="xl">
                {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.firstName || ''} />}
                <AvatarFallback>{getInitials(profile.firstName || 'U')}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {profile.firstName} {profile.lastName || ''}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {profile.email || 'Membre Premium'}
                </p>
                <div className="mt-2">
                  <StreakBadge days={streakInfo.current} isActive={streakInfo.isActive} size="sm" />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border-light)]">
              <XPDisplay current={totalXP} level={currentLevel} toNextLevel={xpForNextLevel} />
            </div>
          </Card>
        </Section>

        {/* Stats overview */}
        <Section>
          <div className="grid grid-cols-3 gap-3">
            <Card padding="default" className="text-center">
              <Scale className="h-5 w-5 text-[var(--accent-primary)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {profile.weight || '--'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">kg actuel</p>
            </Card>

            <Card padding="default" className="text-center">
              <Target className="h-5 w-5 text-[var(--success)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {profile.targetWeight || '--'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">kg objectif</p>
            </Card>

            <Card padding="default" className="text-center">
              <Flame className="h-5 w-5 text-[var(--calories)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {formatNumber(profile.nutritionalNeeds?.calories || 2000)}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">kcal/jour</p>
            </Card>
          </div>
        </Section>

        {/* Mon profil - Expandable sections */}
        <Section title="Mon profil">
          <Card padding="none">
            {/* Informations personnelles */}
            <div className="border-b border-[var(--border-light)]">
              <button
                onClick={() => toggleSection('personal')}
                className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                  <User className="h-5 w-5 text-[var(--text-secondary)]" />
                </div>
                <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                  Informations personnelles
                </span>
                <motion.div
                  animate={{ rotate: expandedSection === 'personal' ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-[var(--text-tertiary)]" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSection === 'personal' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-[var(--text-secondary)]">Prenom</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{profile.firstName || '--'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t border-[var(--border-light)]">
                        <span className="text-sm text-[var(--text-secondary)]">Age</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{profile.age ? `${profile.age} ans` : '--'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t border-[var(--border-light)]">
                        <span className="text-sm text-[var(--text-secondary)]">Taille</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{profile.height ? `${profile.height} cm` : '--'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t border-[var(--border-light)]">
                        <span className="text-sm text-[var(--text-secondary)]">Poids actuel</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{profile.weight ? `${profile.weight} kg` : '--'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t border-[var(--border-light)]">
                        <span className="text-sm text-[var(--text-secondary)]">Poids objectif</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{profile.targetWeight ? `${profile.targetWeight} kg` : '--'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t border-[var(--border-light)]">
                        <span className="text-sm text-[var(--text-secondary)]">Niveau d&apos;activite</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{getActivityLabel(profile.activityLevel)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Objectifs nutritionnels */}
            <div className="border-b border-[var(--border-light)]">
              <button
                onClick={() => toggleSection('goals')}
                className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                  <Target className="h-5 w-5 text-[var(--text-secondary)]" />
                </div>
                <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                  Objectifs nutritionnels
                </span>
                <motion.div
                  animate={{ rotate: expandedSection === 'goals' ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-[var(--text-tertiary)]" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSection === 'goals' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-[var(--text-secondary)]">Objectif</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{getGoalLabel(profile.goal)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t border-[var(--border-light)]">
                        <span className="text-sm text-[var(--text-secondary)]">Calories/jour</span>
                        <span className="text-sm font-medium text-[var(--calories)]">{profile.nutritionalNeeds?.calories || '--'} kcal</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-light)]">
                        <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
                          <p className="text-xs text-[var(--text-tertiary)]">Proteines</p>
                          <p className="text-sm font-semibold text-[var(--proteins)]">
                            {profile.nutritionalNeeds?.proteins || '--'}g
                          </p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
                          <p className="text-xs text-[var(--text-tertiary)]">Glucides</p>
                          <p className="text-sm font-semibold text-[var(--carbs)]">
                            {profile.nutritionalNeeds?.carbs || '--'}g
                          </p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]">
                          <p className="text-xs text-[var(--text-tertiary)]">Lipides</p>
                          <p className="text-sm font-semibold text-[var(--fats)]">
                            {profile.nutritionalNeeds?.fats || '--'}g
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preferences alimentaires */}
            <div className="border-b border-[var(--border-light)]">
              <button
                onClick={() => toggleSection('diet')}
                className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                  <Utensils className="h-5 w-5 text-[var(--text-secondary)]" />
                </div>
                <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                  Preferences alimentaires
                </span>
                <motion.div
                  animate={{ rotate: expandedSection === 'diet' ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-[var(--text-tertiary)]" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSection === 'diet' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-[var(--text-secondary)]">Regime</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" size="sm">{getDietLabel(profile.dietType)}</Badge>
                          {getReligiousDietLabel(profile.religiousDiet) && (
                            <Badge variant="outline" size="sm" className="border-amber-500 text-amber-600">
                              {getReligiousDietLabel(profile.religiousDiet)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {profile.allergies && profile.allergies.length > 0 && (
                        <div className="py-2 border-t border-[var(--border-light)]">
                          <p className="text-sm text-[var(--text-secondary)] mb-2">Allergies</p>
                          <div className="flex flex-wrap gap-1">
                            {profile.allergies.map((allergy) => (
                              <Badge key={allergy} variant="destructive" size="sm">
                                {allergy}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Approche personnalisee (metabolism) */}
            <div className="border-b border-[var(--border-light)]">
              <button
                onClick={() => toggleSection('metabolism')}
                className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div className={cn(
                  'p-2 rounded-lg',
                  profile.metabolismProfile === 'adaptive' ? 'bg-emerald-500/10' : 'bg-[var(--bg-secondary)]'
                )}>
                  <Heart className={cn(
                    'h-5 w-5',
                    profile.metabolismProfile === 'adaptive' ? 'text-emerald-500' : 'text-[var(--text-secondary)]'
                  )} />
                </div>
                <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                  Approche nutritionnelle
                </span>
                {profile.metabolismProfile === 'adaptive' && (
                  <Badge variant="outline" size="sm" className="border-emerald-500 text-emerald-600 mr-2">
                    Bienveillante
                  </Badge>
                )}
                <motion.div
                  animate={{ rotate: expandedSection === 'metabolism' ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-[var(--text-tertiary)]" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSection === 'metabolism' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      <div className={cn(
                        'p-3 rounded-lg',
                        profile.metabolismProfile === 'adaptive'
                          ? 'bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20'
                          : 'bg-[var(--bg-secondary)]'
                      )}>
                        <h4 className={cn(
                          'font-semibold text-sm',
                          profile.metabolismProfile === 'adaptive' ? 'text-emerald-600' : 'text-[var(--text-primary)]'
                        )}>
                          {getMetabolismLabel(profile.metabolismProfile).label}
                        </h4>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          {getMetabolismLabel(profile.metabolismProfile).description}
                        </p>
                        {profile.nutritionalStrategy && (
                          <p className="text-xs text-[var(--text-tertiary)] mt-2 pt-2 border-t border-[var(--border-light)]">
                            Phase: {profile.nutritionalStrategy.currentPhase === 'maintenance'
                              ? 'Stabilisation'
                              : profile.nutritionalStrategy.currentPhase === 'gentle_deficit'
                                ? 'Deficit doux'
                                : 'Reverse dieting'}
                            {' • '}Semaine {profile.nutritionalStrategy.weekInPhase}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Habitudes de vie */}
            <div className="border-b border-[var(--border-light)]">
              <button
                onClick={() => toggleSection('lifestyle')}
                className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                  <Moon className="h-5 w-5 text-[var(--text-secondary)]" />
                </div>
                <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                  Habitudes de vie
                </span>
                <motion.div
                  animate={{ rotate: expandedSection === 'lifestyle' ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-[var(--text-tertiary)]" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSection === 'lifestyle' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      {profile.lifestyleHabits ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-secondary)]">
                            <div className="p-1.5 rounded-full bg-indigo-500/10">
                              <Moon className="h-3.5 w-3.5 text-indigo-500" />
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">Sommeil</p>
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {profile.lifestyleHabits.averageSleepHours}h/nuit
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-secondary)]">
                            <div className="p-1.5 rounded-full bg-cyan-500/10">
                              <Droplets className="h-3.5 w-3.5 text-cyan-500" />
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">Hydratation</p>
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {profile.lifestyleHabits.waterIntakeDaily}L/jour
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-secondary)]">
                            <div className="p-1.5 rounded-full bg-amber-500/10">
                              <Brain className="h-3.5 w-3.5 text-amber-500" />
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">Stress</p>
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {profile.lifestyleHabits.stressLevelDaily === 'low' ? 'Faible'
                                  : profile.lifestyleHabits.stressLevelDaily === 'moderate' ? 'Modere'
                                  : profile.lifestyleHabits.stressLevelDaily === 'high' ? 'Eleve'
                                  : 'Tres eleve'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-secondary)]">
                            <div className="p-1.5 rounded-full bg-orange-500/10">
                              <Activity className="h-3.5 w-3.5 text-orange-500" />
                            </div>
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)]">Sedentarite</p>
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {profile.lifestyleHabits.sedentaryHoursDaily}h/jour
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
                          Aucune donnee. Refais l&apos;onboarding pour renseigner tes habitudes.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Programme sportif */}
            <div>
              <button
                onClick={() => toggleSection('sport')}
                className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <div className={cn(
                  'p-2 rounded-lg',
                  profile.sportTrackingEnabled ? 'bg-violet-500/10' : 'bg-[var(--bg-secondary)]'
                )}>
                  <Dumbbell className={cn(
                    'h-5 w-5',
                    profile.sportTrackingEnabled ? 'text-violet-500' : 'text-[var(--text-secondary)]'
                  )} />
                </div>
                <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                  Programme sportif
                </span>
                {profile.sportTrackingEnabled && (
                  <Badge variant="outline" size="sm" className="border-violet-500 text-violet-600 mr-2">
                    Actif
                  </Badge>
                )}
                <motion.div
                  animate={{ rotate: expandedSection === 'sport' ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-[var(--text-tertiary)]" />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSection === 'sport' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      {profile.sportTrackingEnabled && profile.sportProgram ? (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-gradient-to-r from-violet-500/10 to-transparent border border-violet-500/20">
                            <h4 className="font-medium text-sm text-violet-600">
                              {profile.sportProgram.currentPhase === 'neat_focus'
                                ? 'Phase NEAT'
                                : profile.sportProgram.currentPhase === 'walking_program'
                                  ? 'Programme Marche'
                                  : profile.sportProgram.currentPhase === 'resistance_intro'
                                    ? 'Introduction Musculation'
                                    : 'Programme Complet'}
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)]">
                              Semaine {profile.sportProgram.weekInPhase}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                              <p className="text-xs text-[var(--text-tertiary)]">Objectif pas</p>
                              <p className="text-sm font-semibold text-[var(--text-primary)]">
                                {formatNumber(profile.sportProgram.dailyStepsGoal)}/jour
                              </p>
                            </div>
                            <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                              <p className="text-xs text-[var(--text-tertiary)]">Marche</p>
                              <p className="text-sm font-semibold text-[var(--text-primary)]">
                                {profile.sportProgram.weeklyWalkingMinutes}min/sem
                              </p>
                            </div>
                          </div>
                          {profile.sportProgram.neatActivities && profile.sportProgram.neatActivities.length > 0 && (
                            <div>
                              <p className="text-xs text-[var(--text-tertiary)] mb-1">Activites NEAT</p>
                              <div className="flex flex-wrap gap-1">
                                {profile.sportProgram.neatActivities.slice(0, 3).map((activity, idx) => (
                                  <Badge key={idx} variant="outline" size="sm" className="text-xs">
                                    {activity}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
                          Programme sportif non active. Disponible avec l&apos;approche bienveillante.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </Section>

        {/* Parametres */}
        <Section title="Parametres">
          <Card padding="none">
            <button
              className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-light)]"
              onClick={() => {/* TODO: Notifications settings */}}
            >
              <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
              </div>
              <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                Notifications
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">Bientot</span>
            </button>

            <button
              className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-light)]"
              onClick={() => {/* TODO: Subscription */}}
            >
              <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                <CreditCard className="h-5 w-5 text-[var(--text-secondary)]" />
              </div>
              <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                Abonnement
              </span>
              <Badge variant="default" size="sm">Premium</Badge>
            </button>

            <button
              className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-light)]"
              onClick={() => {/* TODO: Settings */}}
            >
              <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                <Settings className="h-5 w-5 text-[var(--text-secondary)]" />
              </div>
              <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                Parametres
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">Bientot</span>
            </button>

            <button
              className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors"
              onClick={() => {/* TODO: Help */}}
            >
              <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                <HelpCircle className="h-5 w-5 text-[var(--text-secondary)]" />
              </div>
              <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                Aide & Support
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">Bientot</span>
            </button>
          </Card>
        </Section>

        {/* Logout */}
        <Section>
          <Button
            variant="outline"
            className="w-full text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error)]/10"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Se deconnecter
          </Button>
        </Section>

        {/* Version */}
        <div className="text-center py-4">
          <p className="text-xs text-[var(--text-muted)]">
            Presence v1.0.0
          </p>
        </div>
      </PageContainer>
    </>
  )
}
