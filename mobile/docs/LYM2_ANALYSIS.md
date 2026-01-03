# LYM2 - Analyse Approfondie et Plan d'Implémentation

## 1. ANALYSE DE L'EXISTANT

### 1.1 Système d'Objectifs Actuel

**Types définis** (`types/index.ts:11`):
```typescript
type Goal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'health' | 'energy'
```

**Problème identifié**: Le plan propose 3 objectifs finaux mais l'app en a déjà 5. Le plan fusionne implicitement :
- `health` + `energy` + `maintenance` → "Améliorer ma santé"

**Recommandation**: Garder les 5 objectifs existants MAIS restructurer l'expérience post-sélection :
- `weight_loss` → Parcours perte de poids (existant, bien développé)
- `muscle_gain` → Parcours prise de muscle (existant, correct)
- `maintenance` → Fusionner dans "Améliorer ma santé" comme une priorité implicite
- `health` → Déclenche le nouveau module Santé avec priorités
- `energy` → Déclenche le nouveau module Santé avec priorité "Plus d'énergie" pré-sélectionnée

---

### 1.2 Conflits de Philosophie LYM Identifiés

#### ⚠️ CONFLIT 1: Streaks et "Jours d'affilée"

**Code actuel problématique** (`metabolic-boost-store.ts:203-204`):
```typescript
currentStreak: number
longestStreak: number
```

**Problème**: Le concept de "streak" est toxique car :
- Culpabilise les jours manqués
- Crée une pression de performance
- Va contre "à ton rythme"

**Solution proposée**: Remplacer par "présences cette semaine" (0-7), sans historique de "record".

---

#### ⚠️ CONFLIT 2: Wellness Score Chiffré

**Code actuel** (`wellness-store.ts:265-311`):
```typescript
getWellnessScore: (date) => {
  // Retourne un score 0-100
}
```

**Problème**: Un score global de santé est exactement ce que le plan interdit ("jamais de score global santé").

**Solution proposée**: Supprimer `getWellnessScore()` ou le garder UNIQUEMENT pour le backend/analytics, jamais affiché à l'utilisateur.

---

#### ⚠️ CONFLIT 3: Completion Rate et Progression

**Code actuel** (`metabolic-boost-store.ts:360`):
```typescript
if (!lastWeekSummary || lastWeekSummary.completionRate < 70) {
  return { canProgress: false, reason: 'Completion < 70% cette semaine' }
}
```

**Problème**: Le concept de "taux de complétion" implique un échec si < 70%.

**Solution proposée**: Reformuler en "tu as été présent X jours cette semaine" sans condition bloquante. La progression devrait être suggérée, pas conditionnelle.

---

#### ⚠️ CONFLIT 4: XP Rewards pour "Bonnes Valeurs"

**Code actuel** (`wellness-store.ts:89-103`):
```typescript
if (entryData.sleepHours && entryData.sleepHours >= 7) {
  gamification.addXP(XP_REWARDS.GOOD_SLEEP_7H, '7h+ de sommeil')
}
if (entryData.stressLevel && entryData.stressLevel <= 2) {
  gamification.addXP(XP_REWARDS.LOW_STRESS_DAY, 'Stress faible')
}
```

**Problème**: Récompenser les "bonnes" valeurs implique que les autres sont "mauvaises".

**Solution proposée**: XP uniquement pour l'action de logger (participation), pas pour les valeurs.

---

#### ⚠️ CONFLIT 5: Terminologie "Programme" vs "Routine"

**Partout dans le code**: `MetabolicBoostProgram`, `WellnessProgram`, etc.

**Problème**: "Programme" implique une structure rigide avec début/fin.

**Solution proposée**: Renommer progressivement en "Routine Équilibre", "Routine Bien-être".

---

### 1.3 Gaps Techniques Identifiés

#### ❌ GAP 1: Pas de Classification NOVA

**État actuel**: `FoodItem` n'a pas de champ `novaGroup`.

**Impact**: Impossible de détecter "ultra-transformé fréquent" pour les signaux énergie.

**Solution**:
1. Ajouter `novaGroup?: 1 | 2 | 3 | 4` à `FoodItem`
2. Enrichir via OpenFoodFacts API (qui fournit NOVA)
3. Pour CIQUAL/manuel: estimer via heuristique (présence additifs, nom du produit)

---

#### ❌ GAP 2: Pas de Groupes Alimentaires

**État actuel**: `FoodItem.category` existe mais n'est pas structuré pour la diversité.

**Impact**: Impossible de calculer la diversité par groupes (fruits/légumes/protéines/etc.).

**Solution**:
1. Ajouter `foodGroup?: FoodGroup` à `FoodItem`
2. Définir `FoodGroup = 'fruits' | 'vegetables' | 'proteins' | 'legumes' | 'whole_grains' | 'dairy' | 'nuts_seeds' | 'fish'`
3. Mapper les catégories existantes vers ces groupes

---

#### ❌ GAP 3: Fibres Non Trackées Systématiquement

**État actuel**: `fiber?: number` est optionnel dans `NutritionInfo`.

**Impact**: Difficile de détecter "fibres basses 3 jours".

**Solution**: Estimer les fibres pour tous les aliments (CIQUAL les fournit, OFF aussi).

---

#### ❌ GAP 4: Pas de Scheduler de Check-ins

**État actuel**: Check-ins manuels uniquement.

**Impact**: Pas de nudge proactif 2-3×/semaine.

**Solution**: Créer `checkin-scheduler.ts` avec logique:
- Proposer Lundi/Jeudi/Samedi (adaptable)
- Respecter délai 48h minimum après dernier check-in
- Option "pas maintenant" sans pénalité

---

#### ❌ GAP 5: Pas de Service de Recommandations Contextuel

**État actuel**: LymIA Brain génère des conseils mais pas de service dédié "demande de conseil par contexte".

**Impact**: Le plan demande `requestAdvice(context: AdviceContext)`.

**Solution**: Créer `recommendations-service.ts` qui encapsule les appels à LymIA Brain avec le bon contexte.

---

## 2. RISQUES IDENTIFIÉS

### 🔴 RISQUE ÉLEVÉ: Restructuration des Objectifs

**Impact**: Changer la logique des objectifs peut casser l'onboarding et le calcul nutritionnel.

**Mitigation**:
- Garder la structure actuelle de `Goal` type
- Ajouter une couche `HealthPriorities` par-dessus pour `health`/`energy`
- Ne pas modifier le calcul calorique de base

---

### 🟡 RISQUE MOYEN: Migration des Données

**Impact**: Les utilisateurs existants ont des données dans l'ancien format.

**Mitigation**:
- Migrations progressives dans les stores
- Fallbacks pour données manquantes
- Ne pas supprimer les champs existants

---

### 🟡 RISQUE MOYEN: Conflits avec Gamification

**Impact**: La gamification actuelle récompense des métriques "toxiques".

**Mitigation**:
- Phase 1: Ne pas toucher à la gamification existante
- Phase 2: Migrer vers XP pour participation uniquement (post-launch)

---

### 🟢 RISQUE FAIBLE: Ajout de Nouveaux Écrans

**Impact**: Navigation déjà bien structurée.

**Mitigation**: Suivre les patterns existants (Stack.Screen).

---

## 3. PLAN D'IMPLÉMENTATION ADAPTÉ

### Phase 1: Infrastructure (sem 1)

1. **Types et Interfaces**
   - `HealthPriority = 'better_eating' | 'more_energy' | 'stress'`
   - `AdviceContext`, `AdviceCard`, `EnergySignals`
   - `FoodGroup` pour la diversité
   - Ajouter `novaGroup?` et `foodGroup?` à `FoodItem`

2. **Store Goals** (`goals-store.ts`)
   - `healthPriorities: HealthPriority[]` (max 2)
   - `routineEquilibreEnabled: boolean`
   - Actions: `setHealthPriorities()`, `toggleRoutineEquilibre()`

3. **Calculateurs**
   - `diversity-calculator.ts` - Calcul diversité hebdo par groupes
   - `energy-signals.ts` - Détection des 3 signaux
   - `nutrition-insights.ts` - Moyennes 7 jours, fourchettes

---

### Phase 2: Services (sem 1-2)

4. **Recommendations Service**
   - `requestAdvice(context: AdviceContext): Promise<AdviceCard[]>`
   - Interface vers LymIA Brain avec contexte enrichi
   - Stubs avec données mock si backend non dispo

5. **Check-in Scheduler**
   - Logique 2-3×/semaine adaptative
   - Intégration avec notification-service existant
   - Respect du délai 48h

6. **Food Enrichment**
   - Ajout NOVA via OpenFoodFacts
   - Mapping catégories → groupes alimentaires
   - Estimation fibres si manquantes

---

### Phase 3: UI - Objectifs (sem 2)

7. **Modification StepGoal**
   - Si `health` ou `energy` sélectionné → rediriger vers écran priorités
   - Sinon → comportement actuel

8. **HealthPrioritiesScreen**
   - Multi-select (max 2, extensible à 3)
   - Toggle "Routine Équilibre" optionnel
   - Copy bienveillant

9. **Mise à jour OnboardingScreen**
   - Ajouter step 'health-priorities' conditionnel
   - Flow: goal → [health-priorities si santé/énergie] → suite

---

### Phase 4: UI - Santé (sem 2-3)

10. **HealthOverviewScreen**
    - Cards: Variété, Énergie, Routine (si activée), Conseils
    - Macros en fourchettes (jamais de score)
    - Repères hebdo non-culpabilisants

11. **CheckinPromptCard**
    - Emoji scale pour énergie
    - Champs optionnels stress/sommeil/hydratation
    - Bouton "Pas maintenant" proéminent

12. **RoutineEquilibreCard**
    - Repères simples (4 piliers)
    - "Présences cette semaine" au lieu de streak
    - Pas de notion d'échec

---

### Phase 5: Intégration & Analytics (sem 3)

13. **Events Analytics**
    - `objective_selected`
    - `health_priorities_selected`
    - `routine_equilibre_enabled`/`disabled`
    - `checkin_prompt_shown`, `checkin_submitted`
    - `advice_requested`, `advice_viewed`

14. **Intégration LymIA Brain**
    - Adapter `getCoachingAdvice()` pour priorités santé
    - Ajouter contexte diversité et signaux énergie
    - Générer conseils supplémentation (info uniquement)

15. **Tests et Polish**
    - Tests unitaires calculateurs
    - Tests integration stores
    - Review copy FR

---

## 4. STRUCTURE DE FICHIERS PROPOSÉE

```
/src/features/goals/
  GoalSelectionScreen.tsx        # Modifié (redirection si santé)
  HealthPrioritiesScreen.tsx     # NOUVEAU
  HealthOverviewScreen.tsx       # NOUVEAU
  components/
    HealthPriorityCard.tsx
    DiversityWidget.tsx
    MacroRangeCard.tsx
    EnergySignalsCard.tsx
    RoutineEquilibreCard.tsx
  hooks/
    useHealthPriorities.ts
    useDiversityScore.ts
    useEnergySignals.ts
  types.ts
  services/
    recommendations-service.ts   # NOUVEAU
    diversity-calculator.ts      # NOUVEAU
    energy-signals.ts            # NOUVEAU
    nutrition-insights.ts        # NOUVEAU

/src/features/checkin/
  CheckinPromptCard.tsx          # NOUVEAU
  CheckinScreen.tsx              # Modifié
  checkin-scheduler.ts           # NOUVEAU

/src/stores/
  goals-store.ts                 # NOUVEAU
```

---

## 5. DÉCISIONS CLÉS À VALIDER

### Q1: Fusionner `maintenance` dans `health`?

**Option A**: Garder 5 objectifs, `maintenance` reste indépendant
**Option B**: Fusionner `maintenance` + `health` + `energy` → afficher comme priorités

**Recommandation**: Option A pour éviter de casser l'existant. `maintenance` reste, mais on ajoute un écran priorités pour `health` et `energy`.

---

### Q2: Que faire des streaks existants?

**Option A**: Supprimer immédiatement (risque: utilisateurs perdent leur historique)
**Option B**: Garder en backend, ne plus afficher en UI
**Option C**: Renommer en "présences" sans notion de record

**Recommandation**: Option C - migration progressive.

---

### Q3: Faut-il modifier la gamification maintenant?

**Option A**: Refactorer XP pour participation uniquement
**Option B**: Garder XP actuel, focus sur nouvelles features

**Recommandation**: Option B pour cette phase. La gamification est un chantier séparé.

---

### Q4: Où placer le module Santé dans la navigation?

**Option A**: Nouvel onglet "Santé" (remplace ou s'ajoute)
**Option B**: Sous-section dans l'onglet "Coach"
**Option C**: Accessible depuis Home via widget

**Recommandation**: Option C pour commencer, puis évaluer si un onglet dédié est nécessaire.

---

## 6. COPYS FR VALIDÉES

### GoalSelectionScreen
- Title: "Ton objectif"
- Subtitle: "Choisis ce qui compte le plus pour toi en ce moment."

### HealthPrioritiesScreen
- Title: "Tes priorités santé"
- Subtitle: "Choisis 1 ou 2 priorités. Tu pourras changer quand tu veux."
- Options:
  - "Mieux manger" - Variété, qualité, structure sans rigidité
  - "Plus d'énergie" - Stabilité, vitalité au quotidien
  - "Moins de stress" - Apaisement, routines légères
- Toggle Routine:
  - Label: "Activer la routine Équilibre"
  - Helper: "Des repères simples. Sans pression."

### CheckinPromptCard
- "Comment tu te sens aujourd'hui ?"
- Bouton: "Pas maintenant"

### HealthOverviewScreen
- "Repères de la semaine"
- Card diversité: "Variété alimentaire"
- Card énergie: "Ton énergie"
- Card routine: "Routine Équilibre"
- Card conseils: "Conseils du moment"

### Macros (fourchettes)
- "Zone confort" au lieu de "objectif"
- "Repère" au lieu de "cible"
- "Cette semaine" au lieu de "aujourd'hui"

### Supplémentation Disclaimer
- "Repères généraux, pas un avis médical."
- "Si les symptômes persistent, demande l'avis d'un professionnel."

---

## 7. CONCLUSION

Le plan est **ambitieux mais réalisable** en 3 semaines avec les adaptations proposées. Les principaux risques sont:

1. **Conflits de philosophie** → Adressés par renommages et masquage UI
2. **Gaps techniques** → Comblés par nouveaux services/calculateurs
3. **Migration données** → Évitée en ajoutant par-dessus l'existant

**Prochaine étape**: Validation des décisions Q1-Q4, puis démarrage Phase 1.
