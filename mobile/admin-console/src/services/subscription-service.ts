/**
 * Subscription Service
 * Manages premium subscriptions in Supabase
 */

import { supabaseAdmin, PremiumSubscription } from './supabase.js'

export interface GrantPremiumParams {
  email: string
  planType: 'monthly' | 'yearly' | 'lifetime' | 'manual'
  expiresAt?: string | null
  grantedBy?: string
  notes?: string
}

export interface SearchUsersParams {
  query?: string
  limit?: number
  offset?: number
}

export interface UserWithSubscription {
  id: string
  email: string | null
  created_at: string
  subscription?: PremiumSubscription | null
}

class SubscriptionService {
  /**
   * Search users by email
   */
  async searchUsers(params: SearchUsersParams): Promise<UserWithSubscription[]> {
    const { query = '', limit = 50, offset = 0 } = params

    // First, get users from auth.users (requires service role)
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: Math.floor(offset / limit) + 1,
      perPage: limit,
    })

    if (authError) {
      console.error('[SubscriptionService] Error listing users:', authError)
      throw authError
    }

    // Filter by email if query provided
    let filteredUsers = authUsers.users
    if (query) {
      const lowerQuery = query.toLowerCase()
      filteredUsers = filteredUsers.filter(
        u => u.email?.toLowerCase().includes(lowerQuery)
      )
    }

    // Get subscriptions for these users
    const userIds = filteredUsers.map(u => u.id)
    const { data: subscriptions } = await supabaseAdmin
      .from('premium_subscriptions')
      .select('*')
      .in('user_id', userIds)

    // Combine data
    const subscriptionMap = new Map(
      (subscriptions || []).map(s => [s.user_id, s])
    )

    return filteredUsers.map(user => ({
      id: user.id,
      email: user.email || null,
      created_at: user.created_at,
      subscription: subscriptionMap.get(user.id) || null,
    }))
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserWithSubscription | null> {
    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error('[SubscriptionService] Error getting user:', error)
      throw error
    }

    const user = authUsers.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!user) return null

    const { data: subscription } = await supabaseAdmin
      .from('premium_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    return {
      id: user.id,
      email: user.email || null,
      created_at: user.created_at,
      subscription: subscription || null,
    }
  }

  /**
   * Grant premium access to a user
   */
  async grantPremium(params: GrantPremiumParams): Promise<PremiumSubscription> {
    const { email, planType, expiresAt, grantedBy, notes } = params

    // Find user by email
    const user = await this.getUserByEmail(email)

    if (!user) {
      throw new Error(`User not found: ${email}`)
    }

    // Check if subscription already exists
    const { data: existing } = await supabaseAdmin
      .from('premium_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const subscriptionData = {
      user_id: user.id,
      email: email.toLowerCase(),
      status: 'active' as const,
      plan_type: planType,
      expires_at: planType === 'lifetime' || planType === 'manual' ? null : expiresAt,
      granted_by: grantedBy || 'admin',
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      // Update existing subscription
      const { data, error } = await supabaseAdmin
        .from('premium_subscriptions')
        .update(subscriptionData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      return data
    } else {
      // Create new subscription
      const { data, error } = await supabaseAdmin
        .from('premium_subscriptions')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    }
  }

  /**
   * Revoke premium access
   */
  async revokePremium(email: string, reason?: string): Promise<void> {
    const user = await this.getUserByEmail(email)

    if (!user) {
      throw new Error(`User not found: ${email}`)
    }

    const { error } = await supabaseAdmin
      .from('premium_subscriptions')
      .update({
        status: 'cancelled',
        notes: reason ? `Revoked: ${reason}` : 'Manually revoked by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) throw error
  }

  /**
   * Get all active premium subscriptions
   */
  async getActiveSubscriptions(): Promise<PremiumSubscription[]> {
    const { data, error } = await supabaseAdmin
      .from('premium_subscriptions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Get subscription stats
   */
  async getStats(): Promise<{
    totalUsers: number
    premiumUsers: number
    trialUsers: number
    lifetimeUsers: number
  }> {
    const { count: totalUsers } = await supabaseAdmin.auth.admin.listUsers()

    const { data: subscriptions } = await supabaseAdmin
      .from('premium_subscriptions')
      .select('status, plan_type')

    const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || []
    const trialSubscriptions = subscriptions?.filter(s => s.status === 'trial') || []
    const lifetimeSubscriptions = activeSubscriptions.filter(
      s => s.plan_type === 'lifetime' || s.plan_type === 'manual'
    )

    return {
      totalUsers: totalUsers?.users?.length || 0,
      premiumUsers: activeSubscriptions.length,
      trialUsers: trialSubscriptions.length,
      lifetimeUsers: lifetimeSubscriptions.length,
    }
  }
}

export const subscriptionService = new SubscriptionService()
