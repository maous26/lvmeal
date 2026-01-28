# Stratégie d'Exploitation des Données Santé par le Coach LymIA

## Vision

Transformer les données brutes de santé (pas, sommeil, poids, activité) en **insights actionnables et personnalisés** qui créent une valeur réelle pour l'utilisateur, en croisant intelligemment ces données avec la nutrition, le bien-être et les objectifs personnels.

---

## 1. Données Disponibles et Leur Potentiel

### A. Données HealthKit/Health Connect

| Donnée | Source | Fréquence | Fiabilité | Potentiel d'insight |
|--------|--------|-----------|-----------|---------------------|
| **Pas** | Accéléromètre | Continue | Haute | ★★★★★ |
| **Sommeil** | HealthKit/estimé | Quotidienne | Moyenne-Haute | ★★★★★ |
| **Poids** | Balance connectée | Variable | Haute | ★★★★☆ |
| **Calories actives** | Estimation | Continue | Moyenne | ★★★☆☆ |
| **Graisse corporelle** | Bio-impédance | Variable | Basse | ★★☆☆☆ |

### B. Données Nutrition (déjà trackées)

- Calories consommées (par repas et total)
- Macros (protéines, glucides, lipides)
- Timing des repas
- Types d'aliments

### C. Données Bien-être

- Niveau de stress auto-déclaré
- Niveau d'énergie
- Hydratation
- Qualité de sommeil perçue

### D. Données Contextuelles

- Objectif utilisateur (perte, maintien, prise)
- Programme actif (MetabolicBoost, Sport)
- Historique et patterns

---

## 2. Croisements de Données à Haute Valeur

### 2.1. SOMMEIL × NUTRITION

**Corrélations scientifiquement prouvées :**
- Sommeil < 6h → +15-20% sensation de faim (ghréline ↑, leptine ↓)
- Sommeil < 6h → Préférence pour aliments riches en glucides simples
- Sommeil perturbé → Insulino-résistance temporaire

**Insights actionnables :**

```
[Si sommeil < 6h la nuit précédente]
→ Matin: "Nuit courte détectée (5h). Privilégie des repas riches en protéines
   et fibres aujourd'hui pour mieux gérer ta faim. Évite les sucres rapides
   qui risquent de créer des pics/crashes d'énergie."

→ Suggestion repas: Prioriser œufs, yaourt grec, légumineuses

[Si pattern: 3+ nuits < 6h cette semaine]
→ "Ta dette de sommeil s'accumule. C'est normal de ressentir plus de faim
   et de craquer sur des snacks. Focus sur le sommeil ce weekend -
   ça facilitera tout le reste."
```

### 2.2. ACTIVITÉ (PAS) × NUTRITION

**Corrélations :**
- Marche post-prandiale → -30% pic glycémique
- 8000+ pas/jour → Meilleure sensibilité insulinique
- Sédentarité + surplus calorique → Stockage favorisé

**Insights actionnables :**

```
[Après repas copieux détecté]
→ "Repas de 800 kcal détecté. Une marche de 15 min maintenant
   réduirait le pic de sucre de 30%. Même 10 min compte!"

[Si < 3000 pas à 18h]
→ "Journée calme côté mouvement. Pas besoin de culpabiliser,
   mais une petite marche avant le dîner optimiserait l'utilisation
   de tes nutriments."

[Si 10000+ pas + déficit calorique important]
→ "Super journée active (12k pas)! Ton déficit est conséquent aujourd'hui.
   Assure-toi d'avoir assez de protéines au dîner pour la récupération."
```

### 2.3. POIDS × NUTRITION × ACTIVITÉ

**Corrélations :**
- Fluctuation poids ≠ fluctuation graisse (eau, glycogène, sodium)
- Tendance 7j+ > mesure isolée
- Repas riche en sel → +1-2kg lendemain (eau)

**Insights actionnables :**

```
[Si +1kg du jour au lendemain après repas normal]
→ "Ton poids a augmenté d'1kg mais tu étais en déficit hier.
   C'est de la rétention d'eau (repas plus salé? moins d'hydratation?).
   Ça reviendra en 24-48h."

[Si plateau > 14 jours malgré déficit constant]
→ "Plateau depuis 2 semaines malgré tes efforts. Plusieurs options:
   1. Augmente légèrement tes calories 2-3 jours (refeed)
   2. Varie ton activité (intensité différente)
   3. Patience - le corps s'ajuste parfois par paliers"

[Si perte rapide > 1kg/semaine]
→ "Tu perds vite (-1.2kg cette semaine). Super pour la motivation,
   mais assure-toi de garder tes protéines hautes pour préserver
   tes muscles. Tu veux perdre du gras, pas du muscle!"
```

### 2.4. SOMMEIL × ACTIVITÉ × RÉCUPÉRATION

**Corrélations :**
- Sommeil < 7h + activité intense → Récupération compromise
- Sommeil profond favorisé par activité physique
- Over-training = sommeil perturbé

**Insights actionnables :**

```
[Si séance sport intense + nuit courte précédente]
→ "Tu as prévu une séance intense mais ta nuit était courte (5h30).
   Conseil: réduis l'intensité de 20% aujourd'hui.
   La progression vient de la récupération, pas de l'épuisement."

[Si pattern: activité haute + sommeil dégradé]
→ "Tes 3 derniers jours: 10k+ pas/jour mais sommeil < 6h.
   Tu pourrais être en surentraînement léger.
   Journée de récupération active (marche légère, stretching) recommandée."
```

### 2.5. STRESS × NUTRITION × COMPORTEMENT

**Corrélations :**
- Cortisol élevé → Préférence pour comfort food
- Stress chronique → Stockage abdominal favorisé
- Stress → Grignotage émotionnel

**Insights actionnables :**

```
[Si stress déclaré élevé + grignotage détecté]
→ "Journée stressante et quelques snacks en plus - c'est humain.
   Le corps cherche du réconfort. Plutôt que de culpabiliser,
   essaie une marche ou 5 min de respiration profonde."

[Si pattern: stress élevé → surplus calorique]
→ "J'ai remarqué un lien: tes jours de stress élevé correspondent
   souvent à plus de calories. C'est normal (cortisol).
   Préparer des snacks sains à l'avance pourrait aider."
```

---

## 3. Score de Synergie Quotidien

### Concept

Au lieu de juger chaque métrique isolément, créer un **score holistique** qui montre comment les comportements se renforcent (ou se neutralisent).

### Calcul proposé

```typescript
interface DailySynergyScore {
  score: number          // 0-100
  breakdown: {
    sleepNutrition: number     // Synergie sommeil-nutrition
    activityBalance: number    // Activité vs apport
    recoveryQuality: number    // Récupération globale
    consistency: number        // Régularité des habitudes
  }
  highlights: string[]   // Points forts du jour
  opportunities: string[] // Axes d'amélioration sans jugement
}

function calculateDailySynergy(data: {
  sleep: number
  steps: number
  calories: { consumed: number, target: number }
  proteins: { consumed: number, target: number }
  stress: number
  meals: MealEntry[]
}): DailySynergyScore {

  // Sleep-Nutrition Synergy (0-25)
  // Bon sommeil + bonne nutrition = synergie
  const sleepScore = data.sleep >= 7 ? 25 : (data.sleep / 7) * 25
  const nutritionScore = Math.min(
    (data.calories.consumed / data.calories.target),
    1.1
  ) * (data.proteins.consumed / data.proteins.target) * 25
  const sleepNutrition = (sleepScore + nutritionScore) / 2

  // Activity Balance (0-25)
  // Activité adaptée aux apports
  const activityRatio = data.steps / 8000 // baseline 8k
  const calorieBalance = data.calories.consumed / data.calories.target
  // Idéal: plus actif quand plus de calories
  const activityBalance = 25 * (1 - Math.abs(activityRatio - calorieBalance))

  // Recovery Quality (0-25)
  // Sommeil + stress bas = bonne récup
  const recoveryQuality = ((data.sleep / 8) * 15) + ((10 - data.stress) / 10 * 10)

  // Consistency (0-25)
  // Repas réguliers, pas de gros écarts
  const mealSpread = calculateMealSpread(data.meals)
  const consistency = mealSpread < 5 ? 25 : 25 - (mealSpread - 5) * 2

  return {
    score: sleepNutrition + activityBalance + recoveryQuality + consistency,
    breakdown: { sleepNutrition, activityBalance, recoveryQuality, consistency },
    highlights: generateHighlights(data),
    opportunities: generateOpportunities(data)
  }
}
```

### Présentation UI

```
╭─────────────────────────────────╮
│  Synergie du jour: 78/100      │
│  ████████████████░░░░  78%     │
│                                 │
│  ✓ Sommeil réparateur (7h30)   │
│  ✓ Protéines au top (95%)      │
│  ○ Activité légère (4k pas)    │
│                                 │
│  "Journée équilibrée! Une      │
│   petite marche ce soir        │
│   porterait ta synergie à 85+" │
╰─────────────────────────────────╯
```

---

## 4. Patterns Hebdomadaires et Mensuels

### Détection de Patterns

```typescript
interface WeeklyPatterns {
  // Sleep patterns
  sleepDebt: boolean              // < 49h/semaine (7h×7)
  weekendOversleep: boolean       // > 2h de plus le weekend
  inconsistentBedtime: boolean    // > 1h variation

  // Activity patterns
  weekendWarrior: boolean         // 70%+ steps on weekend
  consistentMover: boolean        // > 6000 steps 5+ days

  // Nutrition patterns
  weekendSplurge: boolean         // +30% calories weekend
  proteinConsistent: boolean      // > 80% target 5+ days

  // Combined patterns
  compensationCycle: boolean      // Restriction → binge → culpabilité
  stressEatingDays: string[]      // Jours où stress = surplus
}
```

### Insights de Pattern

```
[Pattern: Weekend Warrior détecté]
→ "Tes weekends sont très actifs (12k pas) vs semaine (4k pas).
   C'est super, mais répartir un peu plus en semaine
   (même 1000 pas de plus/jour) serait plus efficace pour
   le métabolisme que des pics le weekend."

[Pattern: Cycle compensation détecté]
→ "J'observe un schéma: restriction stricte lundi-jeudi,
   puis relâchement vendredi-dimanche. C'est courant et pas grave!
   Mais ça crée du stress. Et si on visait 10% de plus en semaine
   pour moins craquer le weekend?"

[Pattern: Sleep debt + weight stall]
→ "Tu accumules de la dette de sommeil depuis 2 semaines,
   et ton poids stagne. Coïncidence? Probablement pas.
   Le cortisol du manque de sommeil favorise la rétention.
   Priorité #1 cette semaine: dormir."
```

---

## 5. Prédictions et Projections

### Projection Poids

```typescript
interface WeightProjection {
  currentWeight: number
  targetWeight: number
  currentRate: number // kg/week (smoothed)
  projectedDate: Date | null
  confidence: 'high' | 'medium' | 'low'
  factors: {
    positive: string[]  // "Déficit constant", "Protéines ok"
    negative: string[]  // "Sommeil insuffisant", "Stress élevé"
  }
}

function projectWeight(history: WeightEntry[], context: UserContext): WeightProjection {
  const rate = calculateSmoothedRate(history, 14) // 14 jours

  if (rate === 0 || !context.targetWeight) {
    return { projectedDate: null, confidence: 'low', ... }
  }

  const remaining = context.currentWeight - context.targetWeight
  const weeksNeeded = remaining / Math.abs(rate)

  // Ajuster pour facteurs contextuels
  const sleepFactor = context.avgSleep < 6 ? 1.2 : 1 // 20% plus long si mauvais sommeil
  const stressFactor = context.avgStress > 7 ? 1.15 : 1

  const adjustedWeeks = weeksNeeded * sleepFactor * stressFactor

  return {
    projectedDate: addWeeks(new Date(), adjustedWeeks),
    confidence: rate > 0.3 ? 'high' : rate > 0.1 ? 'medium' : 'low',
    factors: {
      positive: getPositiveFactors(context),
      negative: getNegativeFactors(context)
    }
  }
}
```

### Présentation

```
╭──────────────────────────────────────────╮
│  Projection vers ton objectif (85 kg)    │
│                                          │
│  Rythme actuel: -0.4 kg/semaine         │
│  Arrivée estimée: ~12 semaines          │
│  (mi-avril 2026)                         │
│                                          │
│  ✓ Déficit cohérent                     │
│  ✓ Protéines maintenues                 │
│  ⚠ Sommeil à améliorer (-2 sem si 7h+) │
│                                          │
│  "Avec 7h de sommeil en moyenne,        │
│   tu pourrais gagner 2 semaines!"       │
╰──────────────────────────────────────────╯
```

---

## 6. Notifications Contextuelles Intelligentes

### Triggers Basés sur les Données Croisées

```typescript
interface SmartNotificationTrigger {
  id: string
  conditions: Condition[]
  message: (data) => string
  priority: 'high' | 'medium' | 'low'
  timing: 'immediate' | 'delayed' | 'scheduled'
}

const smartTriggers: SmartNotificationTrigger[] = [
  {
    id: 'post_meal_walk_opportunity',
    conditions: [
      { type: 'meal_logged', caloriesMin: 500 },
      { type: 'steps_today', max: 5000 },
      { type: 'time_since_meal', min: 5, max: 30 } // minutes
    ],
    message: (data) => `Repas de ${data.mealCalories} kcal il y a ${data.minutesSinceMeal} min.
      Une marche de 10-15 min maintenant optimiserait l'absorption.
      Tu n'as fait que ${data.stepsToday} pas aujourd'hui.`,
    priority: 'medium',
    timing: 'immediate'
  },

  {
    id: 'sleep_compensation_alert',
    conditions: [
      { type: 'sleep_last_night', max: 5.5 },
      { type: 'hunger_likely_elevated', value: true },
      { type: 'time', range: '10:00-12:00' }
    ],
    message: (data) => `Nuit courte (${data.sleepHours}h).
      Ta faim est probablement plus élevée que d'habitude - c'est physiologique!
      Privilégie un déjeuner riche en protéines et fibres.`,
    priority: 'high',
    timing: 'scheduled' // 10h
  },

  {
    id: 'weekend_warning',
    conditions: [
      { type: 'day', value: 'friday' },
      { type: 'pattern_detected', pattern: 'weekend_splurge' },
      { type: 'time', range: '17:00-19:00' }
    ],
    message: () => `Weekend en vue! Tes données montrent +30% de calories
      les weekends. C'est pas grave, mais si tu veux maintenir ton rythme,
      prévois tes repas à l'avance ou choisis UN repas plaisir.`,
    priority: 'medium',
    timing: 'scheduled' // vendredi 18h
  },

  {
    id: 'weight_fluctuation_reassurance',
    conditions: [
      { type: 'weight_change_24h', min: 0.8 },
      { type: 'calories_yesterday', underTarget: true },
      { type: 'sodium_yesterday', high: true }
    ],
    message: (data) => `+${data.weightChange}kg depuis hier malgré ton déficit?
      C'est de l'eau (repas plus salé, hydratation, cycle menstruel...).
      Ton travail compte. Fais confiance au processus.`,
    priority: 'high',
    timing: 'immediate' // après pesée
  }
]
```

---

## 7. Dashboard Insights

### Vue Quotidienne

```
┌─────────────────────────────────────────────────┐
│  AUJOURD'HUI                          14:32     │
├─────────────────────────────────────────────────┤
│                                                 │
│  SOMMEIL         ACTIVITÉ        NUTRITION      │
│  ┌─────┐        ┌─────┐         ┌─────┐        │
│  │ 7h  │        │ 4.2k│         │ 65% │        │
│  │ ✓   │        │ pas │         │ cal │        │
│  └─────┘        └─────┘         └─────┘        │
│                                                 │
│  ╭─────────────────────────────────────────╮   │
│  │ 🔗 Connexion détectée:                  │   │
│  │                                          │   │
│  │ Ton bon sommeil (7h) = moins de faim    │   │
│  │ aujourd'hui. Profites-en pour faire     │   │
│  │ des choix nutritionnels stratégiques.   │   │
│  ╰─────────────────────────────────────────╯   │
│                                                 │
│  PROCHAINES ACTIONS SUGGÉRÉES:                 │
│  ○ Marche digestive après le déjeuner          │
│  ○ Assurer 30g+ protéines au dîner             │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Vue Hebdomadaire

```
┌─────────────────────────────────────────────────┐
│  CETTE SEMAINE                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  SYNERGIE GLOBALE: 72/100                       │
│  ████████████████████░░░░░░░░  72%             │
│                                                 │
│  Lu  Ma  Me  Je  Ve  Sa  Di                    │
│  ██  ██  ▓▓  ██  ░░  ██  ██                    │
│  85  78  62  81  45  88  79                    │
│                                                 │
│  ╭─────────────────────────────────────────╮   │
│  │ 📊 Pattern de la semaine:               │   │
│  │                                          │   │
│  │ Vendredi = point faible (stress + moins │   │
│  │ de sommeil la veille). C'est récurrent.  │   │
│  │                                          │   │
│  │ Idée: Prépare ton repas du vendredi     │   │
│  │ le jeudi soir pour éviter les choix     │   │
│  │ impulsifs.                               │   │
│  ╰─────────────────────────────────────────╯   │
│                                                 │
│  WINS DE LA SEMAINE:                           │
│  ✓ Protéines > 80% target 5/7 jours           │
│  ✓ Sommeil moyen 6h48 (+12 min vs semaine -1) │
│  ✓ Poids: -0.3 kg (tendance saine)            │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 8. Implémentation Technique

### Nouveau Service: `health-insights-service.ts`

```typescript
// mobile/src/services/health-insights-service.ts

import { getWeeklyHealthSummary, WeeklyHealthSummary } from './health-service'
import { useMealsStore } from '../stores/meals-store'
import { useUserStore } from '../stores/user-store'
import { useWellnessStore } from '../stores/wellness-store'

export interface HealthInsight {
  id: string
  type: 'connection' | 'pattern' | 'projection' | 'opportunity'
  title: string
  message: string
  dataPoints: {
    label: string
    value: string | number
    trend?: 'up' | 'down' | 'stable'
  }[]
  actionable?: {
    action: string
    impact: string
  }
  confidence: number
  generatedAt: string
}

export interface DailyHealthContext {
  sleep: {
    hours: number
    quality: 'poor' | 'fair' | 'good' | 'excellent'
    debtAccumulated: number // heures de dette
  }
  activity: {
    steps: number
    activeMinutes: number
    caloriesBurned: number
  }
  nutrition: {
    caloriesConsumed: number
    caloriesTarget: number
    proteinsConsumed: number
    proteinsTarget: number
    mealsLogged: number
  }
  weight: {
    current: number
    trend7d: number
    trend30d: number
  }
  stress: number
  synergy: number
}

export async function buildDailyHealthContext(): Promise<DailyHealthContext> {
  const healthSummary = await getWeeklyHealthSummary()
  const profile = useUserStore.getState().profile
  const goals = useUserStore.getState().nutritionGoals
  const todayMeals = useMealsStore.getState().getTodayMeals()
  const wellness = useWellnessStore.getState().todayEntry

  // ... build context
}

export async function generateHealthInsights(
  context: DailyHealthContext
): Promise<HealthInsight[]> {
  const insights: HealthInsight[] = []

  // 1. Sleep-Nutrition connection
  if (context.sleep.hours < 6) {
    insights.push({
      id: 'sleep-hunger-connection',
      type: 'connection',
      title: 'Sommeil et appétit',
      message: `Nuit courte (${context.sleep.hours}h). Ta faim sera probablement
        15-20% plus élevée aujourd'hui. C'est physiologique (ghréline/leptine).
        Privilégie protéines et fibres pour mieux la gérer.`,
      dataPoints: [
        { label: 'Sommeil', value: `${context.sleep.hours}h`, trend: 'down' },
        { label: 'Impact faim', value: '+15-20%', trend: 'up' }
      ],
      actionable: {
        action: 'Ajouter 10g de protéines au petit-déjeuner',
        impact: 'Meilleure satiété jusqu\'au déjeuner'
      },
      confidence: 0.85,
      generatedAt: new Date().toISOString()
    })
  }

  // 2. Activity-Nutrition balance
  // 3. Weight fluctuation context
  // 4. Pattern-based predictions
  // ... more insights

  return insights
}

export function calculateSynergyScore(context: DailyHealthContext): number {
  // Implementation as described above
}

export function detectPatterns(
  history: DailyHealthContext[],
  days: number = 14
): WeeklyPatterns {
  // Pattern detection algorithm
}
```

### Intégration avec LymIA Brain

```typescript
// Dans lymia-brain.ts, ajouter:

import {
  buildDailyHealthContext,
  generateHealthInsights,
  DailyHealthContext
} from './health-insights-service'

export async function generateConnectedInsights(
  userContext: UserContext
): Promise<CoachItem[]> {
  // Récupérer le contexte santé complet
  const healthContext = await buildDailyHealthContext()

  // Générer les insights basés sur les corrélations
  const healthInsights = await generateHealthInsights(healthContext)

  // Convertir en CoachItems
  return healthInsights.map(insight => ({
    id: generateId(),
    type: insight.type === 'connection' ? 'analysis' : 'tip',
    category: 'wellness',
    title: insight.title,
    message: insight.message,
    priority: insight.confidence > 0.8 ? 'high' : 'medium',
    linkedFeatures: ['health', 'nutrition'],
    dataPoints: insight.dataPoints,
    actionable: insight.actionable,
    expiresAt: addHours(new Date(), 12).toISOString(),
    createdAt: new Date().toISOString()
  }))
}
```

---

## 9. Respect de la Philosophie LYM

### Principes à Respecter

1. **"Sans jugement. Jamais"**
   - ❌ "Tu n'as pas assez dormi"
   - ✅ "Nuit courte détectée. Voici comment adapter ta journée"

2. **Expliquer le POURQUOI**
   - ❌ "Mange plus de protéines"
   - ✅ "Après une nuit courte, les protéines aident à réguler la ghréline (hormone de la faim)"

3. **Proposer, ne pas imposer**
   - ❌ "Tu dois marcher 10 min après manger"
   - ✅ "Une marche de 10 min réduirait le pic de sucre de 30%. Envie d'essayer?"

4. **Célébrer les connexions positives**
   - ✅ "Belle synergie aujourd'hui: bon sommeil + activité + nutrition équilibrée. Ton corps te remercie!"

5. **Contextualiser les métriques négatives**
   - ❌ "Tu as pris 1kg"
   - ✅ "Le +1kg est de l'eau (sodium hier). Tu étais en déficit. Confiance."

---

## 10. Roadmap d'Implémentation

### Phase 1: Fondations (2-3 semaines)
- [ ] Créer `health-insights-service.ts`
- [ ] Implémenter `buildDailyHealthContext()`
- [ ] Implémenter score de synergie basique
- [ ] Intégrer dans `generateConnectedInsights()`

### Phase 2: Insights Sleep-Nutrition (1-2 semaines)
- [ ] Détection sommeil court → adaptation messages
- [ ] Recommandations repas post-mauvaise nuit
- [ ] Pattern dette de sommeil

### Phase 3: Insights Activité-Nutrition (1-2 semaines)
- [ ] Trigger marche post-prandiale
- [ ] Équilibre activité/apport
- [ ] Weekend warrior detection

### Phase 4: Patterns et Projections (2-3 semaines)
- [ ] Détection patterns hebdomadaires
- [ ] Projection poids intelligente
- [ ] Insights prédictifs (vendredi, weekend)

### Phase 5: Dashboard et UI (2-3 semaines)
- [ ] Vue synergie quotidienne
- [ ] Vue patterns hebdomadaires
- [ ] Intégration écran Progrès

---

## Conclusion

L'exploitation intelligente des données de santé transforme LYM d'une simple app de tracking en un **véritable coach personnel** qui comprend les interconnexions entre sommeil, activité, nutrition et bien-être.

La clé: **des insights contextuels, scientifiquement fondés, et toujours bienveillants**.

Ce n'est pas juste "tu as mal dormi", c'est "voici comment ta nuit courte va affecter ta journée et voici comment t'adapter".

Ce n'est pas "mange moins", c'est "ton activité haute aujourd'hui justifie plus de calories - profite!"

C'est cette intelligence contextuelle qui crée la vraie valeur pour l'utilisateur.
