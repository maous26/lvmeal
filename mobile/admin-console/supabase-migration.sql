-- ============================================================================
-- LYM Premium Subscriptions Table
-- Run this migration in your Supabase SQL Editor
-- ============================================================================

-- Create the premium_subscriptions table
CREATE TABLE IF NOT EXISTS public.premium_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
    plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly', 'lifetime', 'manual')),
    expires_at TIMESTAMPTZ,
    granted_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one subscription per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_user_id ON public.premium_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_email ON public.premium_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_status ON public.premium_subscriptions(status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own subscription
CREATE POLICY "Users can read own subscription"
ON public.premium_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Service role can do everything (for admin console)
CREATE POLICY "Service role has full access"
ON public.premium_subscriptions
FOR ALL
USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_premium_subscriptions_updated_at ON public.premium_subscriptions;
CREATE TRIGGER update_premium_subscriptions_updated_at
    BEFORE UPDATE ON public.premium_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.premium_subscriptions TO authenticated;
GRANT ALL ON public.premium_subscriptions TO service_role;

-- ============================================================================
-- Optional: Function to check premium status (can be called from app)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_premium_status(check_user_id UUID)
RETURNS JSON AS $$
DECLARE
    subscription_record RECORD;
    result JSON;
BEGIN
    SELECT * INTO subscription_record
    FROM public.premium_subscriptions
    WHERE user_id = check_user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW());

    IF FOUND THEN
        result := json_build_object(
            'isPremium', true,
            'planType', subscription_record.plan_type,
            'expiresAt', subscription_record.expires_at
        );
    ELSE
        result := json_build_object(
            'isPremium', false,
            'planType', null,
            'expiresAt', null
        );
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_premium_status(UUID) TO authenticated;
