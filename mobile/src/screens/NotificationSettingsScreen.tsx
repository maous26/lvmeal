import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { ArrowLeft, Sparkles, AlertTriangle, Award, Bell, BellOff, Utensils, MessageCircle } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import {
  scheduleDailyInsightNotification,
  cancelDailyInsightNotification,
} from '../services/daily-insight-service'
import {
  setMealRemindersEnabled,
  scheduleDailyMealReminders,
} from '../services/meal-reminder-service'
import {
  setCoachNotificationsEnabled,
  initializeCoachProactiveService,
} from '../services/coach-proactive-service'
import type { UserProfile } from '../types'

export default function NotificationSettingsScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const { notificationPreferences, updateNotificationPreferences, profile } = useUserStore()

  const handleToggleDailyInsights = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateNotificationPreferences({ dailyInsightsEnabled: value })
    if (value) {
      await scheduleDailyInsightNotification(9)
    } else {
      await cancelDailyInsightNotification()
    }
  }

  const handleToggleAlerts = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateNotificationPreferences({ alertsEnabled: value })
  }

  const handleToggleCelebrations = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateNotificationPreferences({ celebrationsEnabled: value })
  }

  const handleToggleMealReminders = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateNotificationPreferences({ mealRemindersEnabled: value })
    await setMealRemindersEnabled(value)
    if (value && profile) {
      await scheduleDailyMealReminders(profile as UserProfile)
    }
  }

  const handleToggleCoachProactive = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateNotificationPreferences({ coachProactiveEnabled: value })
    await setCoachNotificationsEnabled(value)
    if (value && profile) {
      await initializeCoachProactiveService(profile as UserProfile)
    }
  }

  // Check if user has fasting configured
  const hasFasting = profile?.lifestyleHabits?.fasting?.schedule &&
    profile.lifestyleHabits.fasting.schedule !== 'none'

  const allEnabled = notificationPreferences.dailyInsightsEnabled &&
    notificationPreferences.alertsEnabled &&
    notificationPreferences.celebrationsEnabled &&
    notificationPreferences.mealRemindersEnabled &&
    notificationPreferences.coachProactiveEnabled

  const handleToggleAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const newValue = !allEnabled
    updateNotificationPreferences({
      dailyInsightsEnabled: newValue,
      alertsEnabled: newValue,
      celebrationsEnabled: newValue,
      mealRemindersEnabled: newValue,
      coachProactiveEnabled: newValue,
    })
    if (newValue) {
      scheduleDailyInsightNotification(9)
      await setMealRemindersEnabled(true)
      await setCoachNotificationsEnabled(true)
      if (profile) {
        await scheduleDailyMealReminders(profile as UserProfile)
        await initializeCoachProactiveService(profile as UserProfile)
      }
    } else {
      cancelDailyInsightNotification()
      await setMealRemindersEnabled(false)
      await setCoachNotificationsEnabled(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Notifications IA</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          Configure les notifications intelligentes de ton coach IA. Ces notifications t'aident à atteindre tes objectifs.
        </Text>

        {/* Master Toggle */}
        <Card style={[styles.masterCard, { backgroundColor: colors.bg.elevated }]}>
          <View style={styles.masterToggle}>
            {allEnabled ? (
              <Bell size={24} color={colors.accent.primary} />
            ) : (
              <BellOff size={24} color={colors.text.tertiary} />
            )}
            <View style={styles.masterInfo}>
              <Text style={[styles.masterLabel, { color: colors.text.primary }]}>
                Toutes les notifications
              </Text>
              <Text style={[styles.masterDescription, { color: colors.text.tertiary }]}>
                {allEnabled ? 'Activées' : 'Désactivées'}
              </Text>
            </View>
            <Switch
              value={allEnabled}
              onValueChange={handleToggleAll}
              trackColor={{ false: colors.bg.tertiary, true: colors.accent.light }}
              thumbColor={allEnabled ? colors.accent.primary : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>
        </Card>

        {/* Individual Notifications */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
          Personnaliser
        </Text>

        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          {/* Daily Insights */}
          <View style={[styles.notificationItem, styles.notificationItemBorder, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.notificationIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              <Sparkles size={22} color={colors.accent.primary} />
            </View>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationLabel, { color: colors.text.primary }]}>
                Insights quotidiens
              </Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                Conseil personnalisé chaque matin à 9h basé sur tes données
              </Text>
            </View>
            <Switch
              value={notificationPreferences.dailyInsightsEnabled}
              onValueChange={handleToggleDailyInsights}
              trackColor={{ false: colors.bg.tertiary, true: colors.accent.light }}
              thumbColor={notificationPreferences.dailyInsightsEnabled ? colors.accent.primary : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>

          {/* Alerts */}
          <View style={[styles.notificationItem, styles.notificationItemBorder, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.notificationIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <AlertTriangle size={22} color={colors.warning} />
            </View>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationLabel, { color: colors.text.primary }]}>
                Alertes santé
              </Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                Notifications si anomalie détectée (déficit calorique, déséquilibre)
              </Text>
            </View>
            <Switch
              value={notificationPreferences.alertsEnabled}
              onValueChange={handleToggleAlerts}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(245, 158, 11, 0.3)' }}
              thumbColor={notificationPreferences.alertsEnabled ? colors.warning : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>

          {/* Celebrations */}
          <View style={[styles.notificationItem, styles.notificationItemBorder, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.notificationIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Award size={22} color={colors.success} />
            </View>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationLabel, { color: colors.text.primary }]}>
                Celebrations
              </Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                Séries, badges débloqués et objectifs atteints
              </Text>
            </View>
            <Switch
              value={notificationPreferences.celebrationsEnabled}
              onValueChange={handleToggleCelebrations}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(16, 185, 129, 0.3)' }}
              thumbColor={notificationPreferences.celebrationsEnabled ? colors.success : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>

          {/* Meal Reminders */}
          <View style={[styles.notificationItem, styles.notificationItemBorder, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.notificationIcon, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
              <Utensils size={22} color="#F97316" />
            </View>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationLabel, { color: colors.text.primary }]}>
                Rappels repas
              </Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                {hasFasting
                  ? 'Rappels adaptés à ta fenêtre de jeûne intermittent'
                  : 'Rappels pour petit-déj, déjeuner, goûter et dîner'}
              </Text>
            </View>
            <Switch
              value={notificationPreferences.mealRemindersEnabled}
              onValueChange={handleToggleMealReminders}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(249, 115, 22, 0.3)' }}
              thumbColor={notificationPreferences.mealRemindersEnabled ? '#F97316' : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>

          {/* Coach Proactive */}
          <View style={styles.notificationItem}>
            <View style={[styles.notificationIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
              <MessageCircle size={22} color="#8B5CF6" />
            </View>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationLabel, { color: colors.text.primary }]}>
                Coach proactif
              </Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                Conseils intelligents bases sur tes macros et progres
              </Text>
            </View>
            <Switch
              value={notificationPreferences.coachProactiveEnabled}
              onValueChange={handleToggleCoachProactive}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(139, 92, 246, 0.3)' }}
              thumbColor={notificationPreferences.coachProactiveEnabled ? '#8B5CF6' : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>
        </Card>

        {/* Info */}
        <Card style={[styles.infoCard, { backgroundColor: colors.bg.secondary }]}>
          <Text style={[styles.infoTitle, { color: colors.text.primary }]}>
            Comment ça marche ?
          </Text>
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            Ton coach IA analyse tes données de nutrition, sommeil et activité pour t'envoyer des conseils personnalisés. Plus tu utilises l'app, plus les insights sont pertinents.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h4,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  description: {
    ...typography.body,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  masterCard: {
    marginBottom: spacing.xl,
  },
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  masterInfo: {
    flex: 1,
  },
  masterLabel: {
    ...typography.bodySemibold,
  },
  masterDescription: {
    ...typography.small,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.md,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    gap: spacing.md,
  },
  notificationItemBorder: {
    borderBottomWidth: 1,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationLabel: {
    ...typography.bodyMedium,
  },
  notificationDescription: {
    ...typography.small,
    marginTop: 2,
    lineHeight: 18,
  },
  infoCard: {
    marginTop: spacing.xl,
    padding: spacing.default,
  },
  infoTitle: {
    ...typography.bodySemibold,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.small,
    lineHeight: 20,
  },
})
