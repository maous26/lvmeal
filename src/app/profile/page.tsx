'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User,
  Settings,
  Bell,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Scale,
  Target,
  Utensils,
  Activity,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section, Divider } from '@/components/layout/page-container'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage, getInitials } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StreakBadge, XPDisplay } from '@/components/dashboard/streak-badge'
import { formatNumber } from '@/lib/utils'
import type { UserProfile } from '@/types'

const menuItems = [
  {
    icon: User,
    label: 'Modifier mon profil',
    href: '/profile/edit',
  },
  {
    icon: Target,
    label: 'Objectifs nutritionnels',
    href: '/profile/goals',
  },
  {
    icon: Utensils,
    label: 'Préférences alimentaires',
    href: '/profile/diet',
  },
  {
    icon: Activity,
    label: 'Appareils connectés',
    href: '/profile/devices',
  },
]

const settingsItems = [
  {
    icon: Bell,
    label: 'Notifications',
    href: '/settings/notifications',
  },
  {
    icon: CreditCard,
    label: 'Abonnement',
    href: '/settings/subscription',
    badge: 'Premium',
  },
  {
    icon: Settings,
    label: 'Paramètres',
    href: '/settings',
  },
  {
    icon: HelpCircle,
    label: 'Aide & Support',
    href: '/help',
  },
]

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = React.useState<Partial<UserProfile> | null>(null)

  React.useEffect(() => {
    const storedProfile = localStorage.getItem('userProfile')
    if (storedProfile) {
      setProfile(JSON.parse(storedProfile))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('userProfile')
    router.push('/onboarding')
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  return (
    <>
      <Header title="Profil" />

      <PageContainer>
        {/* Profile header */}
        <Section>
          <Card padding="lg">
            <div className="flex items-center gap-4">
              <Avatar size="xl">
                {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.firstName || ''} />}
                <AvatarFallback>{getInitials(profile.firstName || 'U')}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {profile.firstName} {profile.lastName || ''}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {profile.email || 'Membre Premium'}
                </p>
                <div className="mt-2">
                  <StreakBadge days={7} size="sm" />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border-light)]">
              <XPDisplay current={1250} level={5} toNextLevel={750} />
            </div>
          </Card>
        </Section>

        {/* Stats overview */}
        <Section>
          <div className="grid grid-cols-3 gap-3">
            <Card padding="default" className="text-center">
              <Scale className="h-5 w-5 text-[var(--accent-primary)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {profile.weight || '--'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">kg actuel</p>
            </Card>

            <Card padding="default" className="text-center">
              <Target className="h-5 w-5 text-[var(--success)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {profile.targetWeight || '--'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">kg objectif</p>
            </Card>

            <Card padding="default" className="text-center">
              <Activity className="h-5 w-5 text-[var(--info)] mx-auto mb-1" />
              <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {formatNumber(profile.nutritionalNeeds?.calories || 2000)}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">kcal/jour</p>
            </Card>
          </div>
        </Section>

        {/* Profile menu */}
        <Section title="Mon profil">
          <Card padding="none">
            {menuItems.map((item, index) => {
              const Icon = item.icon
              return (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => router.push(item.href)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-light)] last:border-b-0"
                >
                  <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <Icon className="h-5 w-5 text-[var(--text-secondary)]" />
                  </div>
                  <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                    {item.label}
                  </span>
                  <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)]" />
                </motion.button>
              )
            })}
          </Card>
        </Section>

        {/* Settings menu */}
        <Section title="Paramètres">
          <Card padding="none">
            {settingsItems.map((item, index) => {
              const Icon = item.icon
              return (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                  onClick={() => router.push(item.href)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-light)] last:border-b-0"
                >
                  <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <Icon className="h-5 w-5 text-[var(--text-secondary)]" />
                  </div>
                  <span className="flex-1 text-left font-medium text-[var(--text-primary)]">
                    {item.label}
                  </span>
                  {item.badge && (
                    <Badge variant="default" size="sm">{item.badge}</Badge>
                  )}
                  <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)]" />
                </motion.button>
              )
            })}
          </Card>
        </Section>

        {/* Logout */}
        <Section>
          <Button
            variant="outline"
            className="w-full text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error)]/10"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Se déconnecter
          </Button>
        </Section>

        {/* Version */}
        <div className="text-center py-4">
          <p className="text-xs text-[var(--text-muted)]">
            Presence v1.0.0
          </p>
        </div>
      </PageContainer>
    </>
  )
}
