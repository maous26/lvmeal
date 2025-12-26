'use server'

import OpenAI from 'openai'
import type { UserProfile, ActivityPhase } from '@/types/user'
import type {
  WeeklyProgram,
  GeneratedSession,
  SessionFeedback,
  Exercise,
  ProgramGenerationContext,
  SessionType,
  MuscleGroup,
  Equipment,
} from '@/types/sport'

// OpenAI client (initialized lazily)
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?|\n?```/g, '').trim()
}

// Helper to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// System prompt for LymIA sport program generation
const SPORT_PROGRAM_SYSTEM_PROMPT = `Tu es LymIA, un coach sportif bienveillant spécialisé dans la reprise d'activité physique progressive.

PHILOSOPHIE:
- Bienveillance absolue: jamais de termes négatifs (échec, faible, incapable)
- Progression ultra-douce pour les profils adaptatifs
- Focus sur le bien-être, pas sur la performance
- Célébrer chaque petit progrès
- Adapter selon les retours utilisateur

RÈGLES POUR PROFILS "ADAPTIVE":
- Maximum 3 séances/semaine
- Durée max 30 min au début
- Privilégier la récupération
- Mouvement avant intensité
- Aucun exercice à impact élevé les premières semaines

PHASES DU PROGRAMME LYMIA:
1. Découverte (2-4 sem): Étirements, mobilité, découverte du corps
2. Marche (3-4 sem): 120 min marche/sem, endurance légère
3. Intro Musculation (4-6 sem): 2 séances renforcement/sem + cardio
4. Programme Complet: 3-4 séances/sem avec variation

TYPES DE SÉANCES:
- walking: Marche, cardio léger
- resistance: Musculation, renforcement
- cardio: Cardio, HIIT adapté
- recovery: Récupération active
- stretching: Étirements, mobilité
- hiit: Intervalles haute intensité (phase avancée uniquement)

FORMAT DE RÉPONSE JSON:
{
  "sessions": [
    {
      "dayOfWeek": 1,
      "type": "walking|resistance|cardio|recovery|stretching|hiit",
      "title": "Titre bienveillant",
      "description": "Description encourageante",
      "duration": 20,
      "exercises": [
        {
          "name": "Nom de l'exercice",
          "description": "Comment faire",
          "duration": 60,
          "reps": 10,
          "sets": 2,
          "restBetweenSets": 60,
          "intensity": "low|moderate|high",
          "muscleGroups": ["full_body"],
          "equipment": ["none"],
          "tips": ["Conseil 1"]
        }
      ]
    }
  ],
  "weeklyGoals": {
    "activeMinutes": 60,
    "resistanceSessions": 0,
    "cardioSessions": 2,
    "restDays": 2
  },
  "motivationalMessage": "Message d'encouragement personnalisé",
  "adaptations": ["Changement 1 par rapport à la semaine précédente"]
}`

// Generate weekly program based on user profile and context
export async function generateWeeklyProgram(
  profile: UserProfile,
  context: ProgramGenerationContext
): Promise<WeeklyProgram | null> {
  if (!isOpenAIAvailable()) {
    console.log('OpenAI not available, using fallback program')
    return generateFallbackProgram(profile, context)
  }

  try {
    const client = getOpenAIClient()

    const userPrompt = buildProgramPrompt(profile, context)

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SPORT_PROGRAM_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const parsed = JSON.parse(cleanJsonResponse(content))

    // Transform to WeeklyProgram
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - today.getDay() + 1) // Start Monday
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)

    const weekNumber = context.completedWeeks + 1

    const sessions: GeneratedSession[] = parsed.sessions.map(
      (s: any, index: number) => ({
        id: generateId(),
        weekNumber,
        dayOfWeek: s.dayOfWeek,
        type: s.type as SessionType,
        title: s.title,
        description: s.description,
        duration: s.duration,
        exercises: s.exercises.map((e: any) => ({
          id: generateId(),
          name: e.name,
          description: e.description,
          duration: e.duration,
          reps: e.reps,
          sets: e.sets,
          restBetweenSets: e.restBetweenSets,
          intensity: e.intensity,
          muscleGroups: e.muscleGroups as MuscleGroup[],
          equipment: e.equipment as Equipment[],
          tips: e.tips,
        })),
        warmup: s.warmup,
        cooldown: s.cooldown,
        isCompleted: false,
      })
    )

    return {
      id: generateId(),
      weekNumber,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      sessions,
      weeklyGoals: parsed.weeklyGoals,
      motivationalMessage: parsed.motivationalMessage,
      adaptations: parsed.adaptations,
      isCompleted: false,
    }
  } catch (error) {
    console.error('Error generating program:', error)
    return generateFallbackProgram(profile, context)
  }
}

// Build prompt for program generation
function buildProgramPrompt(
  profile: UserProfile,
  context: ProgramGenerationContext
): string {
  const {
    currentPhase,
    weekInPhase,
    completedWeeks,
    recentFeedbacks,
    completedSessions,
    missedSessions,
    preferredExercises,
    avoidedExercises,
  } = context

  let prompt = `Génère un programme sportif pour la semaine ${completedWeeks + 1}.

PROFIL UTILISATEUR:
- Métabolisme: ${profile.metabolismProfile === 'adaptive' ? 'Adaptatif (progression très douce)' : 'Standard'}
- Âge: ${profile.age || 30} ans
- Poids: ${profile.weight || 70} kg
- Objectif: ${translateGoal(profile.goal)}
- Phase actuelle: ${translatePhase(currentPhase)} (semaine ${weekInPhase} dans cette phase)
`

  if (profile.sportProgram) {
    prompt += `- Séances musculation/semaine: ${profile.sportProgram.resistanceSessionsPerWeek}
- Séances cardio/semaine: ${profile.sportProgram.cardioSessionsPerWeek}
`
  }

  if (completedSessions > 0 || missedSessions > 0) {
    prompt += `\nHISTORIQUE:
- Séances complétées: ${completedSessions}
- Séances manquées: ${missedSessions}
`
  }

  if (recentFeedbacks.length > 0) {
    prompt += `\nRETOURS UTILISATEUR RÉCENTS:`

    const avgFeeling =
      recentFeedbacks.reduce((sum, f) => sum + f.overallFeeling, 0) /
      recentFeedbacks.length

    prompt += `\n- Ressenti moyen: ${avgFeeling.toFixed(1)}/5`

    const difficulties = recentFeedbacks.map((f) => f.perceivedDifficulty)
    const tooHardCount = difficulties.filter((d) => d === 'too_hard').length
    const tooEasyCount = difficulties.filter((d) => d === 'too_easy').length

    if (tooHardCount > 1) {
      prompt += `\n- ATTENTION: ${tooHardCount} séances jugées trop difficiles → RÉDUIRE l'intensité`
    }
    if (tooEasyCount > 2) {
      prompt += `\n- Info: ${tooEasyCount} séances jugées trop faciles → Peut augmenter légèrement`
    }

    const painReports = recentFeedbacks.filter(
      (f) => f.painOrDiscomfort && f.painOrDiscomfort.length > 0
    )
    if (painReports.length > 0) {
      prompt += `\n- DOULEURS SIGNALÉES: ${painReports.map((f) => f.painOrDiscomfort).join(', ')} → Adapter les exercices`
    }
  }

  if (preferredExercises.length > 0) {
    prompt += `\n\nEXERCICES AIMÉS: ${preferredExercises.join(', ')}`
  }

  if (avoidedExercises.length > 0) {
    prompt += `\nEXERCICES À ÉVITER: ${avoidedExercises.join(', ')}`
  }

  prompt += `\n\nGénère un programme adapté à cette personne pour la semaine. Retourne UNIQUEMENT le JSON.`

  return prompt
}

// Translate goal to French
function translateGoal(goal?: string): string {
  const translations: Record<string, string> = {
    weight_loss: 'Perte de poids',
    muscle_gain: 'Prise de muscle',
    maintenance: 'Maintien',
    health: 'Santé générale',
    energy: 'Plus d\'énergie',
  }
  return translations[goal || 'maintenance'] || 'Maintien'
}

// Translate phase to French
function translatePhase(phase: ActivityPhase): string {
  const translations: Record<ActivityPhase, string> = {
    discovery: 'Découverte (étirements, mobilité)',
    walking_program: 'Programme Marche',
    resistance_intro: 'Introduction Musculation',
    full_program: 'Programme Complet',
  }
  return translations[phase]
}

// Fallback program when OpenAI is not available
function generateFallbackProgram(
  profile: UserProfile,
  context: ProgramGenerationContext
): WeeklyProgram {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - today.getDay() + 1)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  const weekNumber = context.completedWeeks + 1
  const isAdaptive = profile.metabolismProfile === 'adaptive'

  // Base sessions based on phase
  const sessions: GeneratedSession[] = []

  if (context.currentPhase === 'discovery') {
    // Phase 1: Discovery - Stretching, mobility, body awareness
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 1,
      type: 'stretching',
      title: 'Réveil en douceur',
      description: 'Quelques étirements pour bien démarrer la semaine',
      duration: 15,
      exercises: [
        {
          id: generateId(),
          name: 'Étirements du matin',
          description: 'Étire doucement tes bras vers le ciel, puis penche-toi sur les côtés',
          duration: 120,
          intensity: 'low',
          muscleGroups: ['full_body'],
          equipment: ['none'],
        },
        {
          id: generateId(),
          name: 'Rotations articulaires',
          description: 'Fais des cercles avec tes poignets, chevilles, épaules et hanches',
          duration: 180,
          intensity: 'low',
          muscleGroups: ['full_body'],
          equipment: ['none'],
        },
      ],
      isCompleted: false,
    })
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 3,
      type: 'recovery',
      title: 'Mobilité douce',
      description: 'Travaille ta mobilité en douceur',
      duration: 15,
      exercises: [
        {
          id: generateId(),
          name: 'Étirements du dos',
          description: 'Position chat-vache: alterne entre dos rond et dos creux',
          duration: 120,
          sets: 2,
          intensity: 'low',
          muscleGroups: ['back', 'core'],
          equipment: ['yoga_mat'],
        },
      ],
      isCompleted: false,
    })
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 5,
      type: 'stretching',
      title: 'Détente du soir',
      description: 'Relâche les tensions de la journée',
      duration: 10,
      exercises: [
        {
          id: generateId(),
          name: 'Relaxation',
          description: 'Assis ou allongé, respire profondément et détends chaque muscle',
          duration: 300,
          intensity: 'low',
          muscleGroups: ['full_body'],
          equipment: ['yoga_mat'],
        },
      ],
      isCompleted: false,
    })
  } else if (context.currentPhase === 'walking_program') {
    // Phase 2: Walking sessions
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 1,
      type: 'walking',
      title: 'Marche énergisante',
      description: 'Une marche tranquille pour te mettre en mouvement',
      duration: 20,
      exercises: [
        {
          id: generateId(),
          name: 'Marche modérée',
          description: 'Marche à ton rythme, respire bien',
          duration: 1200,
          intensity: 'low',
          muscleGroups: ['legs'],
          equipment: ['none'],
        },
      ],
      isCompleted: false,
    })
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 3,
      type: 'walking',
      title: 'Balade active',
      description: 'Explore ton quartier en marchant',
      duration: 25,
      exercises: [
        {
          id: generateId(),
          name: 'Marche découverte',
          description: 'Varie ton itinéraire, découvre de nouveaux endroits',
          duration: 1500,
          intensity: 'moderate',
          muscleGroups: ['legs'],
          equipment: ['none'],
        },
      ],
      isCompleted: false,
    })
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 6,
      type: 'walking',
      title: 'Marche plaisir',
      description: 'Profite du week-end pour marcher un peu plus longtemps',
      duration: 30,
      exercises: [
        {
          id: generateId(),
          name: 'Grande marche',
          description: 'Une belle balade tranquille, écoute un podcast si tu veux',
          duration: 1800,
          intensity: 'low',
          muscleGroups: ['legs'],
          equipment: ['none'],
        },
      ],
      isCompleted: false,
    })
  } else {
    // Phase 3+: Include resistance training
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 1,
      type: 'resistance',
      title: 'Renforcement doux',
      description: 'Quelques exercices simples au poids du corps',
      duration: 20,
      exercises: [
        {
          id: generateId(),
          name: 'Squats assistés',
          description: 'En te tenant à une chaise, descends doucement puis remonte',
          reps: 10,
          sets: 2,
          restBetweenSets: 60,
          intensity: 'low',
          muscleGroups: ['legs', 'glutes'],
          equipment: ['none'],
          tips: ['Garde le dos droit', 'Descends jusqu\'où tu es à l\'aise'],
        },
        {
          id: generateId(),
          name: 'Pompes contre le mur',
          description: 'Face au mur, mains à hauteur des épaules, pousse',
          reps: 8,
          sets: 2,
          restBetweenSets: 60,
          intensity: 'low',
          muscleGroups: ['chest', 'arms'],
          equipment: ['none'],
        },
      ],
      isCompleted: false,
    })
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 3,
      type: 'walking',
      title: 'Marche récupération',
      description: 'Une marche légère pour récupérer',
      duration: 25,
      exercises: [
        {
          id: generateId(),
          name: 'Marche tranquille',
          description: 'Marche à ton propre rythme',
          duration: 1500,
          intensity: 'low',
          muscleGroups: ['legs'],
          equipment: ['none'],
        },
      ],
      isCompleted: false,
    })
    sessions.push({
      id: generateId(),
      weekNumber,
      dayOfWeek: 5,
      type: 'resistance',
      title: 'Renforcement léger',
      description: 'On continue doucement',
      duration: 20,
      exercises: [
        {
          id: generateId(),
          name: 'Pont (glute bridge)',
          description: 'Allongé sur le dos, genoux pliés, lève les hanches',
          reps: 10,
          sets: 2,
          restBetweenSets: 60,
          intensity: 'low',
          muscleGroups: ['glutes', 'core'],
          equipment: ['yoga_mat'],
        },
        {
          id: generateId(),
          name: 'Planche sur genoux',
          description: 'En appui sur les avant-bras et genoux, tiens la position',
          duration: 20,
          sets: 2,
          restBetweenSets: 45,
          intensity: 'low',
          muscleGroups: ['core'],
          equipment: ['yoga_mat'],
        },
      ],
      isCompleted: false,
    })
  }

  // Weekly goals based on phase
  const weeklyGoals = {
    activeMinutes: context.currentPhase === 'discovery' ? 40 :
                   context.currentPhase === 'walking_program' ? 90 : 120,
    resistanceSessions: context.currentPhase === 'discovery' ? 0 :
                        context.currentPhase === 'walking_program' ? 0 : 2,
    cardioSessions: context.currentPhase === 'discovery' ? 0 :
                    context.currentPhase === 'walking_program' ? 3 : 1,
    restDays: 2,
  }

  const motivationalMessages = [
    'Chaque petit pas compte ! Tu es sur la bonne voie.',
    'Ton corps te remercie de prendre soin de lui.',
    'La constance est plus importante que l\'intensité.',
    'Écoute ton corps, il sait ce dont il a besoin.',
    'Tu fais du super travail ! Continue comme ça.',
  ]

  return {
    id: generateId(),
    weekNumber,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    sessions,
    weeklyGoals,
    motivationalMessage:
      motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)],
    adaptations:
      weekNumber > 1 ? ['Programme adapté selon tes progrès'] : undefined,
    isCompleted: false,
  }
}

// Adapt a single session based on feedback
export async function adaptSessionAfterFeedback(
  session: GeneratedSession,
  feedback: SessionFeedback,
  profile: UserProfile
): Promise<GeneratedSession | null> {
  if (!isOpenAIAvailable()) {
    // Simple adaptation without AI
    return adaptSessionFallback(session, feedback)
  }

  try {
    const client = getOpenAIClient()

    const prompt = `L'utilisateur a terminé cette séance:
${JSON.stringify(session, null, 2)}

Voici son feedback:
- Ressenti: ${feedback.overallFeeling}/5
- Difficulté: ${feedback.perceivedDifficulty}
- Énergie après: ${feedback.energyAfter}
- Exercices aimés: ${feedback.likedExercises.join(', ') || 'Aucun spécifié'}
- Exercices non appréciés: ${feedback.dislikedExercises.join(', ') || 'Aucun spécifié'}
${feedback.painOrDiscomfort ? `- Douleur signalée: ${feedback.painOrDiscomfort}` : ''}

Propose une version adaptée de cette séance pour la prochaine fois. Retourne le JSON de la séance modifiée.`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SPORT_PROGRAM_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(cleanJsonResponse(content))

    return {
      ...session,
      ...parsed,
      id: generateId(),
      aiReasoning: 'Séance adaptée selon ton feedback',
    }
  } catch (error) {
    console.error('Error adapting session:', error)
    return adaptSessionFallback(session, feedback)
  }
}

// Simple session adaptation without AI
function adaptSessionFallback(
  session: GeneratedSession,
  feedback: SessionFeedback
): GeneratedSession {
  const adapted = { ...session, id: generateId() }

  // Reduce intensity if too hard
  if (feedback.perceivedDifficulty === 'too_hard') {
    adapted.duration = Math.max(10, session.duration - 5)
    adapted.exercises = session.exercises.map((ex) => ({
      ...ex,
      reps: ex.reps ? Math.max(5, ex.reps - 2) : undefined,
      sets: ex.sets ? Math.max(1, ex.sets - 1) : undefined,
      intensity: 'low' as const,
    }))
    adapted.aiReasoning = 'Intensité réduite selon ton ressenti'
  }

  // Increase slightly if too easy
  if (feedback.perceivedDifficulty === 'too_easy') {
    adapted.duration = Math.min(45, session.duration + 5)
    adapted.exercises = session.exercises.map((ex) => ({
      ...ex,
      reps: ex.reps ? ex.reps + 2 : undefined,
    }))
    adapted.aiReasoning = 'Légèrement augmenté, tu progresses !'
  }

  // Remove disliked exercises
  if (feedback.dislikedExercises.length > 0) {
    adapted.exercises = session.exercises.filter(
      (ex) => !feedback.dislikedExercises.includes(ex.id)
    )
  }

  return adapted
}

// Get personalized recommendations based on recent data
export async function getPersonalizedRecommendations(
  profile: UserProfile,
  context: {
    recentFeedbacks: SessionFeedback[]
    weightHistory: { date: string; weight: number }[]
    currentStreak: number
    missedDays: number
  }
): Promise<string[]> {
  const recommendations: string[] = []

  // Based on weight trend
  if (context.weightHistory.length >= 7) {
    const recent = context.weightHistory.slice(-7)
    const oldest = recent[0].weight
    const newest = recent[recent.length - 1].weight
    const trend = newest - oldest

    if (Math.abs(trend) < 0.2) {
      recommendations.push(
        'Ton poids est stable depuis une semaine. C\'est le moment idéal pour progresser doucement.'
      )
    } else if (trend < -0.5) {
      recommendations.push(
        'Belle progression ! Continue sur cette lancée, sans forcer.'
      )
    }
  }

  // Based on streak
  if (context.currentStreak >= 7) {
    recommendations.push(
      `${context.currentStreak} jours d'affilée ! Tu as créé une vraie habitude.`
    )
  } else if (context.missedDays >= 3) {
    recommendations.push(
      'Pas de souci si tu as manqué quelques jours. L\'important c\'est de reprendre doucement.'
    )
  }

  // Based on feedback patterns
  if (context.recentFeedbacks.length >= 3) {
    const avgFeeling =
      context.recentFeedbacks.reduce((sum, f) => sum + f.overallFeeling, 0) /
      context.recentFeedbacks.length

    if (avgFeeling >= 4) {
      recommendations.push(
        'Tes retours sont très positifs ! Tu peux peut-être passer à la phase suivante.'
      )
    } else if (avgFeeling < 3) {
      recommendations.push(
        'On dirait que les séances sont un peu difficiles. On va ajuster pour que ce soit plus agréable.'
      )
    }

    // Check for consistent pain
    const painCount = context.recentFeedbacks.filter(
      (f) => f.painOrDiscomfort && f.painOrDiscomfort.length > 0
    ).length
    if (painCount >= 2) {
      recommendations.push(
        'Tu as signalé des douleurs récemment. Pense à consulter si ça persiste.'
      )
    }
  }

  return recommendations
}
