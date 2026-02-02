/**
 * MessageRouter - Central arbiter for Coach messages
 *
 * Responsibilities:
 * 1. Receive candidate messages from multiple sources (AI, rules, templates)
 * 2. Check eligibility (cooldowns, topic limits, user preferences)
 * 3. Resolve collisions (same topic, severity rules, TTL)
 * 4. Rank and select messages for delivery
 * 5. Route to appropriate channel (push vs inbox)
 *
 * Key principles:
 * - Max 1 push/day (except critical P0)
 * - Max 1 new non-urgent message/day
 * - 1 primary card, rest in collapsed stack
 * - No message without because_line
 * - Messages expire (TTL)
 */

import { useCoachState, type CoachTopic } from './coach-state'
import {
  useMessageCenter,
  type MessagePriority,
  type MessageType,
  type MessageCategory,
} from './message-center'
import {
  calculateActionabilityScore,
  isInTimingWindow,
  adjustForQuietHours,
} from './coach-timing'

// ============= TYPES =============

export interface CandidateMessage {
  // Core content
  priority: MessagePriority
  type: MessageType
  category: MessageCategory
  topic: CoachTopic
  title: string
  message: string
  emoji?: string

  // Action
  actionLabel?: string
  actionRoute?: string

  // Transparency (REQUIRED for AI, optional for rules)
  becauseLine: string // Human-readable: "Basé sur tes 3 derniers repas"
  reason?: string // Technical: "IA: nutrition - high"
  confidence?: number // 0-1

  // Deduplication
  dedupKey: string

  // TTL
  ttlHours: number // How long this message stays valid

  // Delivery preference
  preferPush: boolean // Should this try to be a push notification?
  urgencyWindow?: number // Hours until this is no longer actionable

  // Source
  source?: string
  isAI: boolean
}

export interface RoutedMessage extends CandidateMessage {
  id: string
  createdAt: string
  expiresAt: string
  deliveryChannel: 'push' | 'inbox'
  read: boolean
  dismissed: boolean
}

export interface RouterDecision {
  accepted: boolean
  reason: string
  channel?: 'push' | 'inbox'
  supersedes?: string[] // IDs of messages this one replaces
}

// ============= COLLISION RULES =============

/**
 * Collision rules V1:
 * - One active message per topic
 * - Higher severity wins
 * - Same severity + same day = replace (don't stack)
 * - TTL-expired messages are removed
 */

interface CollisionRule {
  topic: CoachTopic
  currentSeverity: MessagePriority
  newSeverity: MessagePriority
  action: 'keep_current' | 'replace' | 'stack'
}

const PRIORITY_WEIGHT: Record<MessagePriority, number> = {
  P0: 100,
  P1: 75,
  P2: 50,
  P3: 25,
}

function resolveCollision(
  currentMsg: RoutedMessage | null,
  newMsg: CandidateMessage
): 'keep_current' | 'replace' | 'add' {
  // No existing message = add
  if (!currentMsg) return 'add'

  // Check if current message is expired
  if (currentMsg.expiresAt && new Date(currentMsg.expiresAt) < new Date()) {
    return 'replace'
  }

  // Compare severity
  const currentWeight = PRIORITY_WEIGHT[currentMsg.priority]
  const newWeight = PRIORITY_WEIGHT[newMsg.priority]

  // Higher severity always wins
  if (newWeight > currentWeight) return 'replace'
  if (newWeight < currentWeight) return 'keep_current'

  // Same severity: check if same day
  const currentDate = currentMsg.createdAt.split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  if (currentDate === today) {
    // Same day, same severity = replace (don't stack)
    return 'replace'
  }

  // Different day = add to stack
  return 'add'
}

// ============= PUSH ELIGIBILITY =============

interface PushEligibility {
  eligible: boolean
  reason: string
}

function checkPushEligibility(
  msg: CandidateMessage,
  coachState: ReturnType<typeof useCoachState.getState>
): PushEligibility {
  // P0 always gets push (critical)
  if (msg.priority === 'P0') {
    return { eligible: true, reason: 'P0 messages always get push' }
  }

  // Check daily push limit (max 1/day for non-P0)
  if (!coachState.canSendPush(1)) {
    return { eligible: false, reason: 'Daily push limit reached' }
  }

  // P1 can get push if urgency window is short and actionable
  if (msg.priority === 'P1' && msg.preferPush) {
    const hasShortWindow = msg.urgencyWindow !== undefined && msg.urgencyWindow <= 2
    const isActionable = !!msg.actionRoute

    if (hasShortWindow && isActionable) {
      return { eligible: true, reason: 'P1 with short urgency window' }
    }
  }

  // P2/P3 never get push
  if (msg.priority === 'P2' || msg.priority === 'P3') {
    return { eligible: false, reason: 'P2/P3 messages go to inbox only' }
  }

  // Default: no push
  return { eligible: false, reason: 'Does not meet push criteria' }
}

// ============= ROUTER CLASS =============

class MessageRouter {
  /**
   * Route a candidate message through the system
   */
  route(candidate: CandidateMessage): RouterDecision {
    const coachState = useCoachState.getState()
    const messageCenter = useMessageCenter.getState()

    // GUARD: Reject AI messages without because_line
    if (candidate.isAI && !candidate.becauseLine) {
      return {
        accepted: false,
        reason: 'AI message rejected: missing because_line',
      }
    }

    // GUARD: Check topic cooldown
    const cooldownHours = coachState.getTopicCooldownHours(candidate.topic)
    if (!coachState.canShowTopic(candidate.topic, cooldownHours)) {
      return {
        accepted: false,
        reason: `Topic ${candidate.topic} is in cooldown (${cooldownHours}h)`,
      }
    }

    // GUARD: Check message center cooldown (dedup)
    if (!messageCenter.canSendMessage(candidate.dedupKey, candidate.priority)) {
      return {
        accepted: false,
        reason: `Dedup key ${candidate.dedupKey} is in cooldown`,
      }
    }

    // Find existing message for this topic
    const activeMessages = messageCenter.getActiveMessages()
    const existingForTopic = activeMessages.find(
      (m) => this.getTopicFromCategory(m.category) === candidate.topic && !m.dismissed
    ) as RoutedMessage | undefined

    // Resolve collision
    const collisionResult = resolveCollision(existingForTopic || null, candidate)

    if (collisionResult === 'keep_current') {
      return {
        accepted: false,
        reason: `Existing ${candidate.topic} message has higher or equal priority`,
      }
    }

    // Calculate actionability score for smarter routing
    const topicState = coachState.topicStates[candidate.topic]
    const actionabilityScore = calculateActionabilityScore({
      priority: candidate.priority,
      category: candidate.category,
      hasAction: !!candidate.actionRoute,
      urgencyWindow: candidate.urgencyWindow,
      confidence: candidate.confidence,
      isAI: candidate.isAI,
      userDismissCount: topicState?.dismissCount || 0,
    })

    // Check if we should skip low-scoring messages
    if (actionabilityScore.recommendation === 'skip') {
      return {
        accepted: false,
        reason: `Low actionability score (${actionabilityScore.score})`,
      }
    }

    // Check quiet hours for push
    const quietHoursCheck = adjustForQuietHours(candidate.priority)
    const isQuietTime = quietHoursCheck.action === 'defer'

    // Determine delivery channel
    const pushEligibility = checkPushEligibility(candidate, coachState)
    let channel: 'push' | 'inbox' = pushEligibility.eligible ? 'push' : 'inbox'

    // Downgrade push to inbox if quiet hours or not in timing window
    if (channel === 'push' && candidate.priority !== 'P0') {
      if (isQuietTime) {
        channel = 'inbox'
        console.log(`[MessageRouter] Downgraded to inbox: quiet hours`)
      } else if (!isInTimingWindow() && actionabilityScore.recommendation !== 'push') {
        channel = 'inbox'
        console.log(`[MessageRouter] Downgraded to inbox: not in timing window`)
      }
    }

    // Build supersedes list
    const supersedes: string[] = []
    if (collisionResult === 'replace' && existingForTopic) {
      supersedes.push(existingForTopic.id)
    }

    return {
      accepted: true,
      reason: `${pushEligibility.reason} (score: ${actionabilityScore.score})`,
      channel,
      supersedes,
    }
  }

  /**
   * Process and deliver a candidate message
   */
  async deliver(candidate: CandidateMessage): Promise<string | null> {
    const decision = this.route(candidate)

    if (!decision.accepted) {
      console.log(`[MessageRouter] Rejected: ${decision.reason}`)
      return null
    }

    const messageCenter = useMessageCenter.getState()
    const coachState = useCoachState.getState()

    // Dismiss superseded messages
    if (decision.supersedes) {
      for (const id of decision.supersedes) {
        messageCenter.dismiss(id)
      }
    }

    // Calculate expiration
    const now = new Date()
    const expiresAt = new Date(now.getTime() + candidate.ttlHours * 60 * 60 * 1000)

    // Add message to center
    const id = messageCenter.addMessage({
      priority: candidate.priority,
      type: candidate.type,
      category: candidate.category,
      title: candidate.title,
      message: candidate.message,
      emoji: candidate.emoji,
      actionLabel: candidate.actionLabel,
      actionRoute: candidate.actionRoute,
      reason: candidate.becauseLine, // Use becauseLine as the visible reason
      confidence: candidate.confidence,
      dedupKey: candidate.dedupKey,
      source: candidate.source,
      expiresAt: expiresAt.toISOString(),
    })

    if (id) {
      // Record in coach state
      coachState.recordMessageShown(candidate.topic, decision.channel === 'push')

      // If push, send notification
      if (decision.channel === 'push') {
        await this.sendPushNotification(candidate)
      }

      console.log(`[MessageRouter] Delivered to ${decision.channel}: ${candidate.title}`)
    }

    return id
  }

  /**
   * Batch process multiple candidates
   * Returns the messages that were accepted
   */
  async deliverBatch(candidates: CandidateMessage[]): Promise<string[]> {
    const deliveredIds: string[] = []

    // Sort by priority (P0 first)
    const sorted = [...candidates].sort(
      (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    )

    // Track topics we've already accepted (one per topic rule)
    const acceptedTopics = new Set<CoachTopic>()

    // Track non-urgent count (max 1 new non-urgent per day)
    let nonUrgentCount = 0
    const maxNonUrgent = 1

    for (const candidate of sorted) {
      // Skip if we already accepted a message for this topic
      if (acceptedTopics.has(candidate.topic)) {
        console.log(`[MessageRouter] Skipped: already have ${candidate.topic} message`)
        continue
      }

      // Check non-urgent limit (P2/P3)
      if ((candidate.priority === 'P2' || candidate.priority === 'P3') && nonUrgentCount >= maxNonUrgent) {
        console.log(`[MessageRouter] Skipped: non-urgent limit reached`)
        continue
      }

      const id = await this.deliver(candidate)

      if (id) {
        deliveredIds.push(id)
        acceptedTopics.add(candidate.topic)

        if (candidate.priority === 'P2' || candidate.priority === 'P3') {
          nonUrgentCount++
        }
      }
    }

    return deliveredIds
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(candidate: CandidateMessage): Promise<void> {
    try {
      const { sendNotification } = await import('./notification-service')

      // Map category and priority to notification format
      const categoryMap: Record<MessageCategory, 'nutrition' | 'wellness' | 'sport' | 'progress' | 'alert' | 'behavior'> = {
        nutrition: 'nutrition',
        hydration: 'nutrition',
        sleep: 'wellness',
        sport: 'sport',
        stress: 'wellness',
        progress: 'progress',
        wellness: 'wellness',
        system: 'alert',
      }

      const severityMap: Record<MessagePriority, 'info' | 'warning' | 'celebration' | 'alert'> = {
        P0: 'alert',
        P1: 'warning',
        P2: 'celebration',
        P3: 'info',
      }

      await sendNotification({
        title: candidate.title,
        body: candidate.message,
        category: categoryMap[candidate.category] || 'alert',
        severity: severityMap[candidate.priority],
        deepLink: candidate.actionRoute ? `lym://${candidate.actionRoute}` : undefined,
        source: candidate.source,
      })

      console.log(`[MessageRouter] Push sent: ${candidate.title}`)
    } catch (error) {
      console.error('[MessageRouter] Push failed:', error)
    }
  }

  /**
   * Map category to topic
   */
  private getTopicFromCategory(category: MessageCategory): CoachTopic {
    const mapping: Record<MessageCategory, CoachTopic> = {
      nutrition: 'nutrition',
      hydration: 'hydration',
      sleep: 'sleep',
      sport: 'activity',
      stress: 'wellness',
      progress: 'progress',
      wellness: 'wellness',
      system: 'motivation',
    }
    return mapping[category] || 'motivation'
  }

  /**
   * Clean up expired messages
   */
  cleanupExpired(): void {
    const messageCenter = useMessageCenter.getState()
    messageCenter.clearExpired()
  }
}

// Singleton instance
export const messageRouter = new MessageRouter()

// ============= HELPER FUNCTIONS =============

/**
 * Create a candidate message with all required fields
 */
export function createCandidate(
  params: Omit<CandidateMessage, 'ttlHours' | 'preferPush' | 'isAI'> & {
    ttlHours?: number
    preferPush?: boolean
    isAI?: boolean
  }
): CandidateMessage {
  const defaultTTL: Record<MessagePriority, number> = {
    P0: 24,
    P1: 12,
    P2: 8,
    P3: 4,
  }

  return {
    ...params,
    ttlHours: params.ttlHours ?? defaultTTL[params.priority],
    preferPush: params.preferPush ?? (params.priority === 'P0' || params.priority === 'P1'),
    isAI: params.isAI ?? false,
  }
}

/**
 * Create an AI-generated candidate (requires becauseLine)
 */
export function createAICandidate(
  params: Omit<CandidateMessage, 'ttlHours' | 'preferPush' | 'isAI'>
): CandidateMessage {
  if (!params.becauseLine) {
    throw new Error('AI candidates require a becauseLine')
  }

  return createCandidate({
    ...params,
    isAI: true,
  })
}

/**
 * Create a rule-based candidate (becauseLine optional but recommended)
 */
export function createRuleCandidate(
  params: Omit<CandidateMessage, 'ttlHours' | 'preferPush' | 'isAI' | 'becauseLine'> & {
    becauseLine?: string
  }
): CandidateMessage {
  return createCandidate({
    ...params,
    becauseLine: params.becauseLine || `Alerte: ${params.topic}`,
    isAI: false,
  })
}

export default messageRouter
