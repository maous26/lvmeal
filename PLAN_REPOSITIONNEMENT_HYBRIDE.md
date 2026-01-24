# Plan de Repositionnement LYM
## "Le Coach IA qui te comprend vraiment"

---

## Vision Stratégique

**Positionnement cible** : Coach IA bienveillant avec expertise visible

> *"LYM n'est pas un tracker. C'est un coach nutritionnel IA qui comprend POURQUOI tu manges comme tu manges, et t'accompagne pour changer en douceur."*

**Différenciateurs clés** :
- Bienveillance en surface (ton, messages)
- Expertise en profondeur (visible sur demande)
- Personnalisation prouvée (données utilisateur)
- Sources scientifiques (ANSES, INSERM)

---

## Phase 1 : Visibilité de l'IA (Sprint 1 - 2 semaines)

### Objectif
L'utilisateur VOIT que LYM est différent des autres apps.

### Tâches

#### 1.1 Badge "✨ Conseil IA" sur les messages
- [ ] Créer composant `AIBadge` réutilisable
- [ ] Ajouter sur tous les messages du Coach
- [ ] Design subtil mais visible (étoile + texte)

**Fichiers à modifier** :
- `mobile/src/components/coach/CoachMessageCard.tsx`
- `mobile/src/screens/CoachScreen.tsx`

#### 1.2 Indicateur de personnalisation
- [ ] Afficher "Basé sur tes X repas analysés" sous les conseils
- [ ] Ajouter "Confiance : XX%" (optionnel, en footer)

**Fichiers à modifier** :
- `mobile/src/services/lymia-brain.ts` (retourner metadata)
- `mobile/src/components/coach/CoachMessageCard.tsx`

#### 1.3 Sources scientifiques visibles
- [ ] Ajouter ligne "Source : ANSES" sous conseils pertinents
- [ ] Créer bouton "En savoir plus" → explication

**Fichiers à modifier** :
- `mobile/src/services/lymia-brain.ts` (inclure sources dans response)
- `mobile/src/components/coach/CoachMessageCard.tsx`

#### 1.4 Écran "Mes Insights IA" (nouveau)
- [ ] Créer `AIInsightsScreen.tsx`
- [ ] Afficher les patterns détectés (corrélations)
- [ ] Montrer l'historique des conseils IA

**Fichiers à créer** :
- `mobile/src/screens/AIInsightsScreen.tsx`
- `mobile/src/components/insights/PatternCard.tsx`
- `mobile/src/components/insights/CorrelationGraph.tsx`

---

## Phase 2 : Coaching Conversationnel (Sprint 2-3 - 4 semaines)

### Objectif
L'utilisateur RESSENT une relation avec son coach.

### Tâches

#### 2.1 Historique de conversation Coach
- [ ] Transformer le coach en vue "chat"
- [ ] Garder l'historique des 30 derniers jours
- [ ] Permettre de "répondre" aux conseils

**Fichiers à modifier** :
- `mobile/src/screens/CoachScreen.tsx`
- `mobile/src/stores/coach-store.ts`

#### 2.2 Parcours de changement (14 jours)
- [ ] Créer système de "Défis" avec suivi
- [ ] Ex: "Améliorer mes protéines en 14 jours"
- [ ] Messages quotidiens de suivi personnalisés

**Fichiers à créer** :
- `mobile/src/features/challenges/`
- `mobile/src/stores/challenges-store.ts`
- `mobile/src/screens/ChallengeDetailScreen.tsx`

#### 2.3 Check-ins de suivi
- [ ] "Comment s'est passé le conseil d'hier ?"
- [ ] Feedback utilisateur → améliore les conseils futurs
- [ ] Créer boucle d'apprentissage

**Fichiers à modifier** :
- `mobile/src/services/coach-proactive-service.ts`
- `mobile/src/stores/feedback-store.ts`

#### 2.4 Écran "Mon Profil IA"
- [ ] Ce que LYM a appris sur l'utilisateur
- [ ] Patterns détectés (visuels)
- [ ] "Ton type de mangeur" (catégorisation)

**Fichiers à créer** :
- `mobile/src/screens/AIProfileScreen.tsx`
- `mobile/src/components/profile/EatingTypeCard.tsx`

---

## Phase 3 : Différenciation Marché (Sprint 4-5 - 4 semaines)

### Objectif
Le marché RECONNAÎT LYM comme le coach IA de référence.

### Tâches

#### 3.1 Intégration Apple Watch
- [ ] Données sommeil automatiques
- [ ] Données stress (HRV)
- [ ] Notifications sur la montre

**Fichiers à créer** :
- `mobile/src/services/apple-watch-service.ts`

#### 3.2 Widget iOS "Conseil du jour"
- [ ] Widget avec message IA personnalisé
- [ ] Mise à jour quotidienne

**Fichiers à créer** :
- Configuration Expo widget

#### 3.3 Marketing "Coach Certifié"
- [ ] Landing page repositionnée
- [ ] Témoignages changement comportemental
- [ ] Comparatif vs trackers classiques

#### 3.4 Onboarding repositionné
- [ ] "Bienvenue, je suis ton coach IA"
- [ ] Quiz personnalité alimentaire
- [ ] Premier conseil personnalisé immédiat

**Fichiers à modifier** :
- `mobile/src/screens/OnboardingScreen.tsx`
- `mobile/src/components/onboarding/`

---

## Métriques de Succès

| Métrique | Baseline | Cible Phase 1 | Cible Phase 3 |
|----------|----------|---------------|---------------|
| Retention J7 | À mesurer | 35% | 50% |
| Messages Coach lus | À mesurer | 60% | 85% |
| Conversion Free→Paid | À mesurer | 5% | 10% |
| NPS | À mesurer | +20 | +45 |
| "L'app me comprend" (survey) | À mesurer | 60% | 80% |

---

## Modifications Techniques Requises

### Services à améliorer

1. **lymia-brain.ts**
   - Ajouter `confidence` score à tous les retours
   - Inclure `sources` dans les réponses
   - Tracker `dataPointsUsed` (nombre de repas analysés)

2. **coach-proactive-service.ts** ✅ (déjà fait)
   - Messages 100% IA (plus de templates)
   - Flag `isAIGenerated` dans metadata

3. **behavior-analysis-agent.ts**
   - Exposer les patterns détectés à l'UI
   - Créer API pour "Mes Insights"

4. **agent-coordinator.ts**
   - Exposer les corrélations cross-domaines
   - Historiser les insights générés

### Nouveaux composants UI

```
mobile/src/components/
├── ai/
│   ├── AIBadge.tsx           # Badge "✨ Conseil IA"
│   ├── ConfidenceIndicator.tsx
│   └── SourceFooter.tsx
├── insights/
│   ├── PatternCard.tsx
│   ├── CorrelationGraph.tsx
│   └── InsightTimeline.tsx
├── challenges/
│   ├── ChallengeCard.tsx
│   ├── DayProgress.tsx
│   └── ChallengeComplete.tsx
└── profile/
    ├── EatingTypeCard.tsx
    ├── AILearningsCard.tsx
    └── DataPointsCounter.tsx
```

### Nouveaux écrans

```
mobile/src/screens/
├── AIInsightsScreen.tsx      # Phase 1
├── AIProfileScreen.tsx       # Phase 2
├── ChallengeDetailScreen.tsx # Phase 2
└── ChallengeListScreen.tsx   # Phase 2
```

---

## Risques et Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Surcharge cognitive (trop d'infos IA) | Moyen | Design progressif, info sur demande |
| Coûts OpenAI augmentent | Élevé | Cache agressif, rate limiting |
| Users trouvent l'IA "creepy" | Moyen | Opt-in pour insights détaillés |
| Délais de développement | Moyen | MVP par phase, itérations |

---

## Calendrier Proposé

```
Semaine 1-2  : Phase 1 (Visibilité IA)
Semaine 3-6  : Phase 2 (Coaching conversationnel)
Semaine 7-10 : Phase 3 (Différenciation marché)
Semaine 11   : Tests utilisateurs
Semaine 12   : Launch repositionné
```

---

## Prochaines Actions Immédiates

1. [ ] Créer composant `AIBadge`
2. [ ] Modifier `CoachMessageCard` pour afficher le badge
3. [ ] Ajouter sources ANSES/INSERM visibles
4. [ ] Créer écran `AIInsightsScreen` (MVP)
5. [ ] Mettre à jour onboarding avec "Je suis ton coach IA"

---

*Document créé le 24/01/2026*
*Branche : feature/hybride-repositionnement*
