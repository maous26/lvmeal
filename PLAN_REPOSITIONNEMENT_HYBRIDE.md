# Plan de Repositionnement LYM (Révisé)
## Version Honnête et Réaliste

---

## Analyse Critique : Ce que LYM Peut et Ne Peut Pas Faire

### Ce que LYM FAIT Bien

| Capacité | Niveau | Preuve |
|----------|--------|--------|
| Calcul nutritionnel personnalisé | ✅ Excellent | Mifflin-St Jeor + ANSES |
| Messages 100% IA (pas de templates) | ✅ Récent | `generatePersonalizedMessage()` |
| Détection patterns numériques | ✅ Bon | Sommeil ↔ calories, stress ↔ alimentation |
| Planification repas contrainte | ✅ Bon | 7 jours, allergies, objectifs |
| Base scientifique RAG | ✅ Bon | ANSES, INSERM, HAS |
| UX bienveillante | ✅ Bon | Ton, pas de culpabilisation |

### Ce que LYM NE PEUT PAS Faire

| Promesse | Réalité | Manque |
|----------|---------|--------|
| "Comprend POURQUOI tu manges" | ❌ Non | Pas de contexte émotionnel |
| "Coach comportemental" | ❌ Non | Pas de questionnement socratique |
| "Analyse psychologique" | ❌ Non | Pas de données psycho collectées |
| "Causalité réelle" | ❌ Non | Seulement corrélations numériques |

### La Vérité

> **LYM observe tes données et détecte des patterns. Il ne comprend pas les causes profondes.**

Exemple :
- LYM voit : "Sommeil 4h → Calories +500"
- LYM dit : "Quand tu dors peu, tu manges plus"
- Un vrai coach dirait : "Pourquoi as-tu mal dormi ? Qu'est-ce qui s'est passé ?"

---

## Nouveau Positionnement : Honnête et Différenciant

### Ancien (Trop Ambitieux) ❌

> *"LYM comprend POURQUOI tu manges comme tu manges"*

### Nouveau (Réaliste) ✅

> **"LYM : La nutrition intelligente qui s'adapte à toi."**

Ou variantes :
- "LYM : Ton compagnon nutrition, intelligent et bienveillant"
- "LYM : La nutrition personnalisée par l'IA"
- "LYM : Plus qu'un tracker, un vrai accompagnement"

### Ce qu'on PEUT promettre honnêtement

| Promesse | Justification |
|----------|---------------|
| "Messages personnalisés par l'IA" | ✅ `generatePersonalizedMessage()` - 100% IA |
| "Détecte les liens entre sommeil et alimentation" | ✅ Agent Coordinator fait ça |
| "Conseils basés sur TES données" | ✅ Contexte utilisateur dans tous les prompts |
| "Jamais culpabilisant" | ✅ Ton bienveillant dans les prompts |
| "Sources scientifiques" | ✅ RAG avec ANSES, INSERM |
| "S'adapte à ton jeûne intermittent" | ✅ Fasting context intégré |

### Ce qu'on NE DOIT PAS promettre

- ❌ "Comprend pourquoi tu manges"
- ❌ "Coach comportemental"
- ❌ "Thérapie nutritionnelle"
- ❌ "Analyse tes émotions"

---

## Différenciateurs Réels vs Concurrence

| Feature | Cal AI | YAZIO | Lifesum | **LYM** |
|---------|--------|-------|---------|---------|
| Photo tracking | ✅ | ✅ | ✅ | ✅ |
| Messages IA personnalisés | ❌ Templates | ❌ Templates | ⚠️ Basique | **✅ 100% IA** |
| Corrélations sommeil/nutrition | ❌ | ❌ | ❌ | **✅** |
| Sources scientifiques citées | ❌ | ❌ | ❌ | **✅ ANSES** |
| Jeûne intelligent | Basique | ✅ | ✅ | **✅ Adaptatif** |
| Ton bienveillant garanti | ❌ Neutre | ❌ Neutre | ❌ Gamifié | **✅** |

**Nos vrais différenciateurs :**
1. **Messages 100% IA** (jamais de template)
2. **Corrélations cross-domaines** (sommeil ↔ nutrition ↔ stress)
3. **Sources scientifiques visibles** (ANSES, INSERM)
4. **Bienveillance garantie** (dans chaque prompt IA)

---

## Plan d'Exécution Révisé

### Phase 1 : Visibilité des Vrais Atouts (2 semaines)

**Objectif** : Montrer ce que LYM fait VRAIMENT de différent.

#### 1.1 Badge "✨ Conseil IA personnalisé"
- [ ] Créer composant `AIBadge.tsx`
- [ ] Afficher sur chaque message du Coach
- [ ] Texte : "Personnalisé pour toi" (pas "comprend pourquoi")

```tsx
// mobile/src/components/ai/AIBadge.tsx
<View style={styles.badge}>
  <Text>✨ Personnalisé pour toi</Text>
</View>
```

#### 1.2 Afficher les données utilisées
- [ ] "Basé sur tes X repas"
- [ ] "Analyse de tes Y derniers jours"
- [ ] Montrer que c'est personnalisé avec PREUVES

#### 1.3 Sources scientifiques visibles
- [ ] Ajouter "Source : ANSES" sous les conseils pertinents
- [ ] Créer lien "En savoir plus" → explication

#### 1.4 Corrélations détectées (écran simple)
- [ ] Créer `InsightsScreen.tsx` minimaliste
- [ ] Montrer : "On a détecté que quand tu dors < 6h, tu consommes +15% de calories"
- [ ] Pas de "pourquoi", juste les FAITS observés

**Fichiers à créer/modifier :**
- `mobile/src/components/ai/AIBadge.tsx` (nouveau)
- `mobile/src/components/ai/SourceFooter.tsx` (nouveau)
- `mobile/src/screens/InsightsScreen.tsx` (nouveau, simple)
- `mobile/src/components/coach/CoachMessageCard.tsx` (modifier)

---

### Phase 2 : Améliorer la Personnalisation Réelle (3 semaines)

**Objectif** : Rendre la personnalisation plus profonde SANS mentir.

#### 2.1 Enrichir le contexte des messages IA
- [ ] Ajouter `mealsAnalyzedCount` dans le prompt
- [ ] Ajouter `daysTracked` dans le prompt
- [ ] Ajouter `topPatterns` détectés dans le prompt

#### 2.2 Historique Coach (pas conversation)
- [ ] Garder historique des 30 derniers conseils
- [ ] Permettre de marquer "utile / pas utile"
- [ ] Feedback → améliore les futurs conseils

#### 2.3 Améliorer les corrélations existantes
- [ ] Affiner la détection sommeil ↔ alimentation
- [ ] Ajouter corrélation stress ↔ grignotage
- [ ] Ajouter corrélation weekend ↔ patterns différents

#### 2.4 Onboarding repositionné
- [ ] "Je suis LYM, ton compagnon nutrition intelligent"
- [ ] Pas de promesse de "comprendre pourquoi"
- [ ] Focus sur : personnalisé, bienveillant, scientifique

**Fichiers à modifier :**
- `mobile/src/services/lymia-brain.ts` (enrichir contexte)
- `mobile/src/stores/coach-store.ts` (historique + feedback)
- `mobile/src/screens/OnboardingScreen.tsx` (nouveau discours)

---

### Phase 3 : Collecte de Données Optionnelles (4 semaines)

**Objectif** : Commencer à collecter le "pourquoi" SANS promettre qu'on le comprend.

#### 3.1 Champ "Note rapide" après chaque repas (optionnel)
- [ ] "Comment te sens-tu ?" (1 tap : 😊 😐 😔 😫)
- [ ] "Une note ?" (optionnel, texte libre)
- [ ] Stocker mais NE PAS analyser encore

#### 3.2 Check-in wellness amélioré
- [ ] Ajouter "Raison du stress" (optionnel) : Travail / Famille / Santé / Autre
- [ ] Stocker pour future analyse

#### 3.3 Préparer l'infrastructure (sans activer)
- [ ] Stocker les notes textuelles
- [ ] Préparer le schema pour analyse future
- [ ] Ne PAS promettre qu'on analyse

**Note importante** : Cette phase collecte des données pour le FUTUR. On ne promet pas encore de les analyser.

---

### Phase 4 : Évaluation et Décision (2 semaines)

**Objectif** : Décider si on peut aller plus loin.

#### 4.1 Analyser les données collectées
- [ ] Combien d'utilisateurs remplissent les notes ?
- [ ] Y a-t-il des patterns dans les raisons de stress ?
- [ ] Les feedbacks "utile/pas utile" montrent quoi ?

#### 4.2 Décision Go/No-Go
- Si données riches → Phase 5 (analyse comportementale)
- Si données pauvres → Rester sur positionnement actuel

---

## Ce qu'on NE FAIT PAS (et pourquoi)

| Feature Envisagée | Pourquoi Non |
|-------------------|--------------|
| "Je comprends pourquoi tu manges" | Mensonge - on n'a pas les données |
| Questionnement socratique | Trop complexe, risque de mal faire |
| Analyse psychologique | Pas qualifiés, risque éthique |
| Coaching comportemental | Nécessite formation professionnelle |
| Promesse de changement | On accompagne, on ne garantit pas |

---

## Métriques de Succès Révisées

| Métrique | Cible Phase 1 | Cible Phase 3 |
|----------|---------------|---------------|
| % utilisateurs qui voient badge IA | 100% | 100% |
| % qui cliquent "En savoir plus" (sources) | 10% | 15% |
| % messages Coach lus | 50% | 70% |
| Feedback "utile" sur conseils | - | 60% |
| Retention J7 | 30% | 40% |
| NPS | +15 | +30 |

---

## Messaging Marketing Révisé

### Page App Store

**Avant (trop ambitieux) :**
> "LYM comprend pourquoi tu manges et t'aide à changer"

**Après (honnête) :**
> "LYM : La nutrition intelligente qui s'adapte à toi.
>
> ✨ Conseils personnalisés par l'IA - jamais de messages génériques
> 📊 Détecte les liens entre ton sommeil et ton alimentation
> 🔬 Basé sur les recommandations ANSES
> 💚 Bienveillant - jamais culpabilisant"

### Onboarding

**Écran 1 :**
> "Salut ! Je suis LYM, ton compagnon nutrition.
> Je vais apprendre à te connaître pour te donner des conseils vraiment adaptés à toi."

**Écran 2 :**
> "Plus tu m'utilises, plus je deviens pertinent.
> Chaque repas que tu enregistres m'aide à mieux te conseiller."

**Écran 3 :**
> "Je ne suis pas un coach humain, mais je suis toujours là, bienveillant, et basé sur la science."

---

## Calendrier Révisé

```
Semaine 1-2  : Phase 1 - Visibilité des vrais atouts
Semaine 3-5  : Phase 2 - Améliorer personnalisation réelle
Semaine 6-9  : Phase 3 - Collecte données optionnelles
Semaine 10-11: Phase 4 - Évaluation et décision
Semaine 12   : Go/No-Go pour évolution future
```

---

## Prochaines Actions Immédiates

1. [ ] Créer `AIBadge.tsx` avec texte "Personnalisé pour toi"
2. [ ] Ajouter badge sur `CoachMessageCard.tsx`
3. [ ] Créer `SourceFooter.tsx` pour afficher "Source : ANSES"
4. [ ] Modifier onboarding : retirer toute promesse de "comprendre"
5. [ ] Créer écran `InsightsScreen.tsx` simple (corrélations factuelles)

---

## Engagement Éthique

**Ce que LYM s'engage à faire :**
- ✅ Être honnête sur ses capacités
- ✅ Ne jamais culpabiliser
- ✅ Citer ses sources
- ✅ Personnaliser vraiment (pas de templates)
- ✅ Protéger les données utilisateur

**Ce que LYM s'engage à NE PAS faire :**
- ❌ Prétendre comprendre la psychologie
- ❌ Donner des conseils médicaux
- ❌ Promettre des résultats
- ❌ Mentir sur ses capacités IA

---

*Document révisé le 24/01/2026*
*Branche : feature/hybride-repositionnement*
*Principe : Promettre moins, délivrer plus.*
