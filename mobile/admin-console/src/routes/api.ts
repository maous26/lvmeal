/**
 * API Routes for Admin Console
 */

import { Router, Request, Response } from 'express'
import { subscriptionService } from '../services/subscription-service.js'
import { requireAuth, handleLogin, handleLogout, checkAuth } from '../middleware/auth.js'

const router = Router()

// ============================================================================
// AUTH ROUTES
// ============================================================================

router.post('/auth/login', handleLogin)
router.post('/auth/logout', requireAuth, handleLogout)
router.get('/auth/check', checkAuth)

// ============================================================================
// SUBSCRIPTION ROUTES (Protected)
// ============================================================================

/**
 * GET /api/stats
 * Get dashboard statistics
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await subscriptionService.getStats()
    res.json(stats)
  } catch (error: any) {
    console.error('[API] Error getting stats:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/users
 * Search users
 */
router.get('/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string | undefined
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const users = await subscriptionService.searchUsers({ query, limit, offset })
    res.json(users)
  } catch (error: any) {
    console.error('[API] Error searching users:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/users/:email
 * Get user by email
 */
router.get('/users/:email', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await subscriptionService.getUserByEmail(req.params.email)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  } catch (error: any) {
    console.error('[API] Error getting user:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/subscriptions
 * Get all active subscriptions
 */
router.get('/subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const subscriptions = await subscriptionService.getActiveSubscriptions()
    res.json(subscriptions)
  } catch (error: any) {
    console.error('[API] Error getting subscriptions:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/subscriptions/grant
 * Grant premium access to a user
 */
router.post('/subscriptions/grant', requireAuth, async (req: Request, res: Response) => {
  try {
    const { email, planType, expiresAt, notes } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    if (!planType || !['monthly', 'yearly', 'lifetime', 'manual'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' })
    }

    const subscription = await subscriptionService.grantPremium({
      email,
      planType,
      expiresAt,
      grantedBy: req.session?.username || 'admin',
      notes,
    })

    console.log(`[API] Premium granted to ${email} (${planType}) by ${req.session?.username}`)
    res.json(subscription)
  } catch (error: any) {
    console.error('[API] Error granting premium:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/subscriptions/revoke
 * Revoke premium access
 */
router.post('/subscriptions/revoke', requireAuth, async (req: Request, res: Response) => {
  try {
    const { email, reason } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    await subscriptionService.revokePremium(email, reason)

    console.log(`[API] Premium revoked for ${email} by ${req.session?.username}`)
    res.json({ success: true })
  } catch (error: any) {
    console.error('[API] Error revoking premium:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
