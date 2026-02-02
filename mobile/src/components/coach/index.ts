/**
 * Coach Components - Cockpit UX
 *
 * Architecture en 3 couches:
 * - Couche 1: FeaturedInsight (carte primaire)
 * - Couche 2: MessageStack (pile compressée)
 * - Couche 3: CoachHistoryScreen (traçabilité)
 */

export { CoachMessageCard } from './CoachMessageCard'
export type { CoachMessageCardProps } from './CoachMessageCard'

export { FeaturedInsight } from './FeaturedInsight'
export { MessageStack } from './MessageStack'
export { CollapsibleSection } from './CollapsibleSection'
