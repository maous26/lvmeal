/**
 * Conversation Offline Service (Check #8)
 *
 * Handles:
 * - Network state detection
 * - Offline fallback responses
 * - Request queuing for retry
 * - Latency timeout handling
 * - Graceful degradation
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  ConversationResponse,
  ConversationContextFull,
  UserIntent,
} from '../types/conversation'

// ============================================================================
// TYPES
// ============================================================================

export interface NetworkStatus {
  isConnected: boolean
  isInternetReachable: boolean | null
  type: string
  lastChecked: string
}

export interface QueuedRequest {
  id: string
  type: 'message' | 'intent'
  payload: string | UserIntent
  timestamp: string
  retryCount: number
}

export interface OfflineConfig {
  maxRetries: number
  retryDelayMs: number
  llmTimeoutMs: number
  fallbackEnabled: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY_QUEUE = 'conversation_offline_queue'
const STORAGE_KEY_NETWORK = 'conversation_network_status'

const DEFAULT_CONFIG: OfflineConfig = {
  maxRetries: 3,
  retryDelayMs: 5000,
  llmTimeoutMs: 10000, // 10s timeout for LLM calls
  fallbackEnabled: true,
}

// ============================================================================
// OFFLINE FALLBACK RESPONSES
// ============================================================================

/**
 * Pre-defined fallback responses for when LLM/network is unavailable
 * These are stored locally and don't require network
 */
const OFFLINE_RESPONSES: Partial<Record<UserIntent, ConversationResponse>> = {
  HUNGER: {
    message: {
      text: "Je vois que tu as faim ! Je n'ai pas accès au réseau en ce moment, mais voici quelques idées : une salade protéinée, un sandwich équilibré, ou des fruits avec du yaourt. Dès que la connexion revient, je pourrai te proposer quelque chose de plus personnalisé.",
      tone: 'supportive',
      emoji: '🍽️',
    },
    actions: [
      {
        type: 'NAVIGATE_TO',
        label: 'Voir mes repas sauvegardés',
        params: { screen: 'WeeklyPlan' },
        requiresConfirmation: false,
        isPremium: false,
      },
    ],
    meta: {
      responseId: `offline_hunger_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      model: 'rules',
      processingTimeMs: 0,
    },
  },

  CRAVING: {
    message: {
      text: "Une envie ? C'est normal ! Sans connexion, je ne peux pas analyser en détail, mais essaie de boire un verre d'eau et d'attendre 10 minutes. Souvent, ça aide à y voir plus clair.",
      tone: 'empathetic',
      emoji: '💭',
    },
    actions: [],
    meta: {
      responseId: `offline_craving_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      model: 'rules',
      processingTimeMs: 0,
    },
  },

  STRESS: {
    message: {
      text: "Je sens que tu traverses un moment difficile. Même sans connexion, tu peux faire un exercice de respiration : inspire 4 secondes, retiens 7 secondes, expire 8 secondes. Répète 3 fois.",
      tone: 'empathetic',
      emoji: '🧘',
    },
    actions: [
      {
        type: 'START_BREATHING',
        label: 'Exercice de respiration',
        params: { technique: '4-7-8' },
        requiresConfirmation: false,
        isPremium: false,
      },
    ],
    meta: {
      responseId: `offline_stress_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      model: 'rules',
      processingTimeMs: 0,
    },
  },

  FATIGUE: {
    message: {
      text: "La fatigue, ça arrive. Sans connexion, je te suggère : boire de l'eau, faire une petite pause, et peut-être un encas léger si ça fait longtemps que tu n'as pas mangé.",
      tone: 'supportive',
      emoji: '💤',
    },
    actions: [],
    meta: {
      responseId: `offline_fatigue_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      model: 'rules',
      processingTimeMs: 0,
    },
  },

  PROGRESS_CHECK: {
    message: {
      text: "Je n'ai pas accès à tes données détaillées sans connexion. Mais je peux te dire : chaque jour compte, et tu fais déjà un effort en utilisant l'app. Dès que la connexion revient, je te fais un vrai bilan !",
      tone: 'encouraging',
      emoji: '📊',
    },
    actions: [
      {
        type: 'NAVIGATE_TO',
        label: 'Voir mes progrès (cache)',
        params: { screen: 'Progress' },
        requiresConfirmation: false,
        isPremium: false,
      },
    ],
    meta: {
      responseId: `offline_progress_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      model: 'rules',
      processingTimeMs: 0,
    },
  },

  GREETING: {
    message: {
      text: "Salut ! Je suis en mode hors-ligne pour le moment. Je peux quand même t'aider avec des conseils de base. Qu'est-ce qui t'amène ?",
      tone: 'casual',
      emoji: '👋',
    },
    actions: [],
    ui: {
      quickReplies: [
        { label: "J'ai faim", intent: 'HUNGER' },
        { label: 'Journée difficile', intent: 'STRESS' },
        { label: 'Aide', intent: 'HELP' },
      ],
    },
    meta: {
      responseId: `offline_greeting_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      model: 'rules',
      processingTimeMs: 0,
    },
  },

  HELP: {
    message: {
      text: "Je suis là pour t'aider ! En mode hors-ligne, je peux te donner des conseils généraux. Dès que la connexion revient, j'aurai accès à toutes tes données pour un accompagnement personnalisé.",
      tone: 'informative',
      emoji: '💡',
    },
    actions: [],
    meta: {
      responseId: `offline_help_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      model: 'rules',
      processingTimeMs: 0,
    },
  },

  UNKNOWN: {
    message: {
      text: "Je suis en mode hors-ligne et je n'ai pas bien compris ta demande. Essaie avec des mots simples comme 'faim', 'stress', ou 'aide'. Dès que la connexion revient, je pourrai mieux t'aider !",
      tone: 'casual',
      emoji: '📶',
    },
    actions: [],
    ui: {
      quickReplies: [
        { label: "J'ai faim", intent: 'HUNGER' },
        { label: 'Stress', intent: 'STRESS' },
        { label: 'Aide', intent: 'HELP' },
      ],
    },
    meta: {
      responseId: `offline_unknown_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      model: 'rules',
      processingTimeMs: 0,
    },
  },
}

// ============================================================================
// SERVICE
// ============================================================================

class ConversationOfflineService {
  private networkStatus: NetworkStatus = {
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    lastChecked: new Date().toISOString(),
  }

  private config: OfflineConfig = DEFAULT_CONFIG
  private requestQueue: QueuedRequest[] = []
  private unsubscribeNetInfo: (() => void) | null = null

  /**
   * Initialize the service and start network monitoring
   */
  async initialize(): Promise<void> {
    // Load queue from storage
    await this.loadQueue()

    // Subscribe to network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(this.handleNetworkChange)

    // Get initial network state
    const state = await NetInfo.fetch()
    this.handleNetworkChange(state)

    console.log('[OfflineService] Initialized, connected:', this.networkStatus.isConnected)
  }

  /**
   * Cleanup on unmount
   */
  cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo()
      this.unsubscribeNetInfo = null
    }
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange = (state: NetInfoState): void => {
    const wasConnected = this.networkStatus.isConnected

    this.networkStatus = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      lastChecked: new Date().toISOString(),
    }

    // If we just came back online, process queue
    if (!wasConnected && this.networkStatus.isConnected) {
      console.log('[OfflineService] Connection restored, processing queue')
      this.processQueue()
    }

    // Save status
    this.saveNetworkStatus()
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.networkStatus.isConnected && this.networkStatus.isInternetReachable !== false
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus }
  }

  /**
   * Get offline fallback response for an intent
   */
  getOfflineFallback(intent: UserIntent): ConversationResponse {
    const fallback = OFFLINE_RESPONSES[intent] || OFFLINE_RESPONSES.UNKNOWN

    // Clone and update timestamp
    return {
      ...fallback!,
      meta: {
        ...fallback!.meta,
        responseId: `offline_${intent.toLowerCase()}_${Date.now()}`,
        generatedAt: new Date().toISOString(),
      },
      // Add offline indicator
      disclaimer: '📶 Mode hors-ligne - Réponse limitée',
    }
  }

  /**
   * Create a timeout promise for LLM calls
   */
  createTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs ?? this.config.llmTimeoutMs

    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error('LLM_TIMEOUT'))
        }, timeout)
      }),
    ])
  }

  /**
   * Wrap an async operation with offline handling
   */
  async withOfflineHandling<T>(
    operation: () => Promise<T>,
    fallback: T,
    options?: { timeoutMs?: number; retryOnTimeout?: boolean }
  ): Promise<{ result: T; isOffline: boolean; isTimeout: boolean }> {
    // Check if offline
    if (!this.isOnline()) {
      console.log('[OfflineService] Offline, returning fallback')
      return { result: fallback, isOffline: true, isTimeout: false }
    }

    try {
      // Try operation with timeout
      const result = await this.createTimeout(operation(), options?.timeoutMs)
      return { result, isOffline: false, isTimeout: false }
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'LLM_TIMEOUT'

      if (isTimeout) {
        console.log('[OfflineService] Operation timed out')
      } else {
        console.error('[OfflineService] Operation failed:', error)
      }

      return { result: fallback, isOffline: false, isTimeout }
    }
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Add request to queue for later retry
   */
  async queueRequest(type: 'message' | 'intent', payload: string | UserIntent): Promise<void> {
    const request: QueuedRequest = {
      id: `queued_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    }

    this.requestQueue.push(request)
    await this.saveQueue()

    console.log('[OfflineService] Request queued:', request.id)
  }

  /**
   * Process queued requests when back online
   */
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0) return

    console.log('[OfflineService] Processing', this.requestQueue.length, 'queued requests')

    const toRetry = [...this.requestQueue]
    this.requestQueue = []

    for (const request of toRetry) {
      if (request.retryCount >= this.config.maxRetries) {
        console.log('[OfflineService] Max retries reached, dropping:', request.id)
        continue
      }

      // Wait between retries
      if (request.retryCount > 0) {
        await this.sleep(this.config.retryDelayMs)
      }

      // Check if still online
      if (!this.isOnline()) {
        // Put back in queue
        this.requestQueue.push({ ...request, retryCount: request.retryCount + 1 })
        continue
      }

      // TODO: Emit event for retry processing
      // This would be handled by the conversation store
      console.log('[OfflineService] Would retry:', request.id, request.type)
    }

    await this.saveQueue()
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.requestQueue.length
  }

  /**
   * Clear the queue
   */
  async clearQueue(): Promise<void> {
    this.requestQueue = []
    await AsyncStorage.removeItem(STORAGE_KEY_QUEUE)
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_QUEUE)
      if (stored) {
        this.requestQueue = JSON.parse(stored)
      }
    } catch (error) {
      console.error('[OfflineService] Failed to load queue:', error)
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(this.requestQueue))
    } catch (error) {
      console.error('[OfflineService] Failed to save queue:', error)
    }
  }

  private async saveNetworkStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_NETWORK, JSON.stringify(this.networkStatus))
    } catch (error) {
      console.error('[OfflineService] Failed to save network status:', error)
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<OfflineConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get loading message for UI
   */
  getLoadingMessage(isLLMCall: boolean = false): string {
    if (isLLMCall) {
      return 'Je réfléchis...'
    }
    return 'Un instant...'
  }

  /**
   * Get timeout message for UI
   */
  getTimeoutMessage(): string {
    return 'La connexion est lente. Je te donne une réponse simplifiée en attendant.'
  }

  /**
   * Get offline message for UI
   */
  getOfflineMessage(): string {
    return 'Tu es hors-ligne. Je peux quand même t\'aider avec des conseils de base.'
  }
}

// Export singleton
export const conversationOfflineService = new ConversationOfflineService()
