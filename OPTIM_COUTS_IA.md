# Optimisation des Couts IA - LYM App

**Date:** 31 Decembre 2024
**Branche:** `optim`
**Statut:** Implemente

---

## Modele Economique

L'IA est le levier principal de monetisation. La gamification engage les utilisateurs,
mais c'est l'abonnement Premium qui donne acces a l'IA.

### Flux Utilisateur

```
Inscription → Trial 7 jours (15 credits) → Fin trial → 3 credits/mois (frustrant)
                                                              ↓
                                                    Upgrade Premium → IA illimitee
```

---

## Credits IA par Statut

| Statut | Credits IA | Modele | Description |
|--------|------------|--------|-------------|
| **Trial** (7 jours) | 15 | gpt-4o-mini | Gouter l'IA, pas assez pour rester |
| **Free** (apres trial) | 3/mois | gpt-4o-mini | Frustrant, pousse vers Premium |
| **Premium** | Illimite | gpt-4o | Experience complete |

### Cout par Requete

| Type | Credits | Description |
|------|---------|-------------|
| `coach_insight` | 1 | Conseil coach |
| `behavior_analysis` | 2 | Analyse comportementale RAG |
| `meal_plan` | 1 | Generation plan repas |
| `photo_analysis` | 1 | Analyse photo |
| `wellness_advice` | 1 | Conseil bien-etre |
| `chat` | 1 | Chat libre |

---

## Gamification (Engagement, PAS monetisation)

Les tiers de gamification donnent des badges et features, PAS des credits IA:

| Tier | XP Requis | Avantages |
|------|-----------|-----------|
| Bronze | 0 | Suivi repas, Objectifs, Stats de base |
| Silver | 500 | Recettes perso, Historique, Export |
| Gold | 2000 | Badge exclusif, Acces prioritaire |
| Diamond | 10000 | Badge legendaire, 1 mois Premium offert |

**Note:** Meme Diamond a besoin de Premium pour IA illimitee (sauf 1 mois offert).

---

## Implementation Technique

### 1. Service AI Rate Limiter (`ai-rate-limiter.ts`)

```typescript
// Logique de credits
- Premium → 999 credits (illimite), modele gpt-4o
- Trial → 15 credits sur 7 jours, modele gpt-4o-mini
- Free → 3 credits/mois, modele gpt-4o-mini
```

### 2. Gamification Store (`gamification-store.ts`)

```typescript
// Nouvelles constantes
export const TRIAL_DURATION_DAYS = 7
export const TRIAL_AI_CREDITS = 15
export const FREE_MONTHLY_AI_CREDITS = 3

// Nouveau champ
isPremium: boolean  // Controle par systeme de paiement

// Nouvelles fonctions
setPremium(isPremium: boolean)  // Appele par le systeme de paiement
```

### 3. Cache TTL (economie de credits)

| Type | TTL | Justification |
|------|-----|---------------|
| `coach_insight` | 4h | Conseils stables |
| `behavior_analysis` | 24h | Patterns lents |
| `meal_plan` | 1h | Adapte a l'heure |
| `wellness_advice` | 4h | Conseils stables |
| `photo_analysis` | 0 | Chaque photo unique |
| `chat` | 0 | Temps reel |

---

## Economies Realisees

### Avant Optimisation
- Modele: `gpt-4o` partout
- Pas de rate limiting
- Pas de cache
- **Cout estime: ~$0.10-0.50/utilisateur/jour**

### Apres Optimisation
- Free users: `gpt-4o-mini` (97% moins cher)
- Cache: ~50% appels evites
- Rate limiting: max 3 appels/mois gratuits
- **Cout estime: ~$0.002-0.01/utilisateur free/mois**

### Reduction
- **~95% reduction pour utilisateurs gratuits**
- **Premium: cout compense par abonnement**

---

## Integration Paiement (TODO)

Quand le systeme de paiement sera implemente:

```typescript
// Apres validation paiement
import { useGamificationStore } from './stores/gamification-store'

// Activer Premium
useGamificationStore.getState().setPremium(true)

// Desactiver (fin abonnement)
useGamificationStore.getState().setPremium(false)
```

---

## Fichiers Modifies

```
mobile/src/services/
├── ai-rate-limiter.ts (MODIFIE - logique Premium)
├── lymia-brain.ts (MODIFIE - 8 fonctions)
└── behavior-analysis-agent.ts (MODIFIE - 1 fonction)

mobile/src/stores/
└── gamification-store.ts (MODIFIE - isPremium, setPremium)

mobile/src/screens/
└── OnboardingScreen.tsx (MODIFIE - startTrial)
```

---

## Prochaines Etapes

1. [ ] Implementer systeme de paiement (Stripe/RevenueCat)
2. [ ] Appeler `setPremium(true)` apres paiement reussi
3. [ ] Ajouter ecran "Passer a Premium" quand credits epuises
4. [ ] Monitoring couts reels en production
5. [ ] A/B test: 15 vs 20 credits trial
