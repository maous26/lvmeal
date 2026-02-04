/**
 * Supabase Admin Client
 * Uses service role key for full database access
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Types for our database tables
export interface UserProfile {
  id: string
  user_id: string
  email?: string
  profile: Record<string, unknown>
  nutrition_goals: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PremiumSubscription {
  id: string
  user_id: string
  email: string
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  plan_type: 'monthly' | 'yearly' | 'lifetime' | 'manual'
  expires_at: string | null
  created_at: string
  updated_at: string
  granted_by: string | null
  notes: string | null
}
