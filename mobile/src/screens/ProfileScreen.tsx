import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native'
import {
  User,
  Target,
  Scale,
  Activity,
  Utensils,
  Bell,
  BellRing,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Award,
  Flame,
  Zap,
  Heart,
  Edit3,
  Moon,
  Sun,
  Sparkles,
  AlertTriangle,
  PartyPopper,
  Pin,
  RotateCcw,
  Database,
  ChefHat,
  ShoppingCart,
  Leaf,
} from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import { Card, Badge, ProgressBar, Button } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMetabolicBoostStore } from '../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../stores/wellness-program-store'
import { formatNumber } from '../lib/utils'
import type { RootStackParamList } from '../navigation/RootNavigator'
import {
  scheduleDailyInsightNotification,
  cancelDailyInsightNotification,
} from '../services/daily-insight-service'
import {
  useMealInputPreferencesStore,
  ALL_INPUT_METHODS,
  DEFAULT_PINNED_METHODS,
} from '../stores/meal-input-preferences-store'
import type { MealSourcePreference } from '../types'

// Labels for meal source preferences
const mealSourceLabels: Record<MealSourcePreference, { label: string; description: string; icon: 'Leaf' | 'ChefHat' | 'ShoppingCart' | 'Database' }> = {
  fresh: {
    label: 'Produits frais',
    description: 'Priorité aux fruits, légumes, viandes (CIQUAL)',
    icon: 'Leaf',
  },
  recipes: {
    label: 'Recettes maison',
    description: 'Priorité aux plats élaborés (Gustar)',
    icon: 'ChefHat',
  },
  quick: {
    label: 'Rapide & pratique',
    description: 'Priorité aux produits du commerce (OFF)',
    icon: 'ShoppingCart',
  },
  balanced: {
    label: 'Équilibré',
    description: 'Mix intelligent de toutes les sources',
    icon: 'Database',
  },
}

const goalLabels: Record<string, string> = {
  weight_loss: 'Perdre du poids',
  lose: 'Perdre du poids',
  maintain: 'Maintenir',
  maintenance: 'Maintenir',
  gain: 'Prendre du poids',
  muscle_gain: 'Prise de muscle',
  muscle: 'Prise de muscle',
  health: 'Améliorer ma santé',
  energy: 'Plus d\'énergie',
}

const activityLabels: Record<string, string> = {
  sedentary: 'Sédentaire',
  light: 'Légèrement actif',
  moderate: 'Modérément actif',
  active: 'Actif',
  very_active: 'Très actif',
  athlete: 'Athlète',
}

const dietLabels: Record<string, string> = {
  none: 'Sans restriction',
  omnivore: 'Omnivore',
  vegetarian: 'Végétarien',
  vegan: 'Vegan',
  pescatarian: 'Pescatarien',
  keto: 'Keto',
  paleo: 'Paléo',
  halal: 'Halal',
  casher: 'Casher',
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { colors, isDark, toggleTheme } = useTheme()
  const { profile, nutritionGoals, resetStore, setProfile, updateProfile, notificationPreferences, updateNotificationPreferences } = useUserStore()
  const {
    isEnrolled: isMetabolicEnrolled,
    enroll: enrollMetabolic,
    unenroll: unenrollMetabolic,
    currentPhase: metabolicPhase,
    currentWeek: metabolicWeek,
  } = useMetabolicBoostStore()

  const {
    isEnrolled: isWellnessEnrolled,
    enroll: enrollWellness,
    unenroll: unenrollWellness,
    currentPhase: wellnessPhase,
    currentWeek: wellnessWeek,
  } = useWellnessProgramStore()

  const {
    pinnedMethods,
    resetToDefaults: resetMealInputPreferences,
  } = useMealInputPreferencesStore()

  // Program exclusion rules
  // - Metabolic: disabled if Wellness is active (exclusive program)
  // - Wellness: disabled if Metabolic is active
  const canToggleMetabolic = !isWellnessEnrolled
  const canToggleWellness = !isMetabolicEnrolled

  // Blocking reasons for UI feedback
  const metabolicBlockedReason = isWellnessEnrolled
    ? 'Désactivez le programme Bien-être d\'abord'
    : null
  const wellnessBlockedReason = isMetabolicEnrolled
    ? 'Désactivez le programme Métabolisme d\'abord'
    : null

  const userName = profile?.firstName || profile?.name || 'Utilisateur'
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleEditProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.navigate('EditProfile')
  }

  const handleSettingPress = (setting: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // TODO: Navigate to setting screen
    console.log('Navigate to:', setting)
  }

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ? Vous retournerez à l\'écran d\'onboarding.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => {
            resetStore()
          },
        },
      ]
    )
  }

  const handleResetData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    Alert.alert(
      'Réinitialiser les données',
      'Cette action supprimera toutes vos données. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => {
            resetStore()
          },
        },
      ]
    )
  }

  const handleReplayOnboarding = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Revoir l\'onboarding',
      'Cela te permettra de revoir le nouvel onboarding marketing. Tes données seront conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Revoir',
          onPress: () => {
            useUserStore.getState().setOnboarded(false)
          },
        },
      ]
    )
  }

  const handleToggleDarkMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    toggleTheme()
  }

  const handleToggleDailyInsights = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateNotificationPreferences({ dailyInsightsEnabled: value })
    if (value) {
      await scheduleDailyInsightNotification(9) // 9h par défaut
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

  const handleResetMealInputPreferences = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Réinitialiser',
      'Remettre les méthodes d\'ajout par défaut ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => {
            resetMealInputPreferences()
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          },
        },
      ]
    )
  }

  // Get pinned methods labels for display
  const pinnedMethodsLabels = pinnedMethods
    .map(id => ALL_INPUT_METHODS.find(m => m.id === id)?.labelShort || id)
    .join(', ')

  const handleToggleMetabolic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (isMetabolicEnrolled) {
      Alert.alert(
        'Quitter le programme',
        'Êtes-vous sûr de vouloir quitter le programme Métabolisme ? Votre progression sera conservée.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Quitter',
            style: 'destructive',
            onPress: () => {
              unenrollMetabolic()
              if (profile) {
                setProfile({ ...profile, metabolicProgramActive: false })
              }
            },
          },
        ]
      )
    } else {
      Alert.alert(
        'Rejoindre le programme',
        'Le programme Métabolisme vous aide à relancer votre métabolisme en douceur sur 9 semaines.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Commencer',
            onPress: () => {
              enrollMetabolic()
              if (profile) {
                setProfile({ ...profile, metabolicProgramActive: true })
              }
            },
          },
        ]
      )
    }
  }

  const handleToggleWellness = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (isWellnessEnrolled) {
      Alert.alert(
        'Quitter le programme',
        'Êtes-vous sûr de vouloir quitter le programme Bien-être ? Votre progression sera conservée.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Quitter',
            style: 'destructive',
            onPress: () => {
              unenrollWellness()
              if (profile) {
                setProfile({ ...profile, wellnessProgramActive: false })
              }
            },
          },
        ]
      )
    } else {
      Alert.alert(
        'Rejoindre le programme',
        'Le programme Bien-être vous accompagne pour améliorer votre sommeil, gérer le stress et cultiver la sérénité sur 8 semaines.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Commencer',
            onPress: () => {
              enrollWellness()
              if (profile) {
                setProfile({ ...profile, wellnessProgramActive: true })
              }
            },
          },
        ]
      )
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Profil</Text>
        </View>

        {/* Profile Card */}
        <Card style={[styles.profileCard, { backgroundColor: colors.bg.elevated }]}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: colors.accent.primary }]}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text.primary }]}>{userName}</Text>
              <Text style={[styles.profileEmail, { color: colors.text.tertiary }]}>{profile?.email || 'Aucun email'}</Text>
            </View>
            <TouchableOpacity onPress={handleEditProfile} style={[styles.editButton, { backgroundColor: colors.accent.light }]}>
              <Edit3 size={18} color={colors.accent.primary} />
              <Text style={[styles.editButtonText, { color: colors.accent.primary }]}>Modifier</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={[styles.statsRow, { borderTopColor: colors.border.light }]}>
            <View style={styles.statItem}>
              <Flame size={20} color={colors.warning} />
              <Text style={[styles.statValue, { color: colors.text.primary }]}>12</Text>
              <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>Streak</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
            <View style={styles.statItem}>
              <Award size={20} color={colors.accent.primary} />
              <Text style={[styles.statValue, { color: colors.text.primary }]}>5</Text>
              <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>Badges</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
            <View style={styles.statItem}>
              <Activity size={20} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.text.primary }]}>Niv. 3</Text>
              <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>Niveau</Text>
            </View>
          </View>
        </Card>

        {/* Current Goals */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Mes objectifs</Text>
          <TouchableOpacity onPress={handleEditProfile} style={[styles.sectionEditButton, { backgroundColor: colors.accent.light }]}>
            <Edit3 size={16} color={colors.accent.primary} />
          </TouchableOpacity>
        </View>
        <Card style={[styles.goalsCard, { backgroundColor: colors.bg.elevated }]}>
          <View style={[styles.goalItem, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.goalIcon, { backgroundColor: colors.bg.secondary }]}>
              <Target size={20} color={colors.accent.primary} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalLabel, { color: colors.text.tertiary }]}>Objectif</Text>
              <Text style={[styles.goalValue, { color: colors.text.primary }]}>
                {goalLabels[profile?.goal || 'maintain']}
              </Text>
            </View>
          </View>

          <View style={[styles.goalItem, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.goalIcon, { backgroundColor: colors.bg.secondary }]}>
              <Scale size={20} color={colors.secondary.primary} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalLabel, { color: colors.text.tertiary }]}>Poids actuel</Text>
              <Text style={[styles.goalValue, { color: colors.text.primary }]}>
                {profile?.weight || 70} kg
                {profile?.targetWeight && ` → ${profile.targetWeight} kg`}
              </Text>
            </View>
          </View>

          <View style={[styles.goalItem, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.goalIcon, { backgroundColor: colors.bg.secondary }]}>
              <Activity size={20} color={colors.success} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalLabel, { color: colors.text.tertiary }]}>Niveau d'activité</Text>
              <Text style={[styles.goalValue, { color: colors.text.primary }]}>
                {activityLabels[profile?.activityLevel || 'moderate']}
              </Text>
            </View>
          </View>

          <View style={[styles.goalItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.goalIcon, { backgroundColor: colors.bg.secondary }]}>
              <Utensils size={20} color={colors.nutrients.carbs} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={[styles.goalLabel, { color: colors.text.tertiary }]}>Régime alimentaire</Text>
              <Text style={[styles.goalValue, { color: colors.text.primary }]}>
                {dietLabels[profile?.dietType || 'omnivore']}
              </Text>
            </View>
          </View>
        </Card>

        {/* Daily Targets */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Objectifs journaliers</Text>
        <Card style={[styles.targetsCard, { backgroundColor: colors.bg.elevated }]}>
          <View style={styles.targetItem}>
            <Text style={[styles.targetLabel, { color: colors.text.secondary }]}>Calories</Text>
            <Text style={[styles.targetValue, { color: colors.text.primary }]}>
              {formatNumber(nutritionGoals?.calories || 2000)} kcal
            </Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={[styles.targetLabel, { color: colors.text.secondary }]}>Protéines</Text>
            <Text style={[styles.targetValue, { color: colors.nutrients.proteins }]}>
              {nutritionGoals?.proteins || 100}g
            </Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={[styles.targetLabel, { color: colors.text.secondary }]}>Glucides</Text>
            <Text style={[styles.targetValue, { color: colors.nutrients.carbs }]}>
              {nutritionGoals?.carbs || 250}g
            </Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={[styles.targetLabel, { color: colors.text.secondary }]}>Lipides</Text>
            <Text style={[styles.targetValue, { color: colors.nutrients.fats }]}>
              {nutritionGoals?.fats || 67}g
            </Text>
          </View>
        </Card>

        {/* Programs - 2 programs: Métabolisme and Bien-être */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Programmes</Text>
        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          {/* Métabolisme - disabled if Wellness active */}
          <TouchableOpacity
            style={[styles.programItem, styles.programItemBorder, { borderBottomColor: colors.border.light }, !canToggleMetabolic && !isMetabolicEnrolled && styles.programItemDisabled]}
            onPress={canToggleMetabolic || isMetabolicEnrolled ? handleToggleMetabolic : undefined}
            activeOpacity={canToggleMetabolic || isMetabolicEnrolled ? 0.7 : 1}
          >
            <View style={[styles.programIcon, styles.programIconMetabolic, isMetabolicEnrolled && styles.programIconMetabolicActive]}>
              <Zap size={20} color={isMetabolicEnrolled ? '#FFFFFF' : colors.warning} />
            </View>
            <View style={styles.programInfo}>
              <Text style={[styles.programLabel, { color: colors.text.primary }, !canToggleMetabolic && !isMetabolicEnrolled && { color: colors.text.muted }]}>
                Métabolisme
              </Text>
              <Text style={[styles.programDescription, { color: colors.text.tertiary }]}>
                {isMetabolicEnrolled
                  ? `Phase ${metabolicPhase} - Semaine ${metabolicWeek}`
                  : metabolicBlockedReason || 'Relancer ton métabolisme'}
              </Text>
            </View>
            <Switch
              value={isMetabolicEnrolled}
              onValueChange={handleToggleMetabolic}
              disabled={!canToggleMetabolic && !isMetabolicEnrolled}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(245, 158, 11, 0.3)' }}
              thumbColor={isMetabolicEnrolled ? colors.warning : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </TouchableOpacity>

          {/* Bien-être - disabled if Metabolic active */}
          <TouchableOpacity
            style={[styles.programItem, !canToggleWellness && !isWellnessEnrolled && styles.programItemDisabled]}
            onPress={canToggleWellness || isWellnessEnrolled ? handleToggleWellness : undefined}
            activeOpacity={canToggleWellness || isWellnessEnrolled ? 0.7 : 1}
          >
            <View style={[styles.programIcon, styles.programIconWellness, isWellnessEnrolled && styles.programIconWellnessActive]}>
              <Heart size={20} color={isWellnessEnrolled ? '#FFFFFF' : colors.secondary.primary} />
            </View>
            <View style={styles.programInfo}>
              <Text style={[styles.programLabel, { color: colors.text.primary }, !canToggleWellness && !isWellnessEnrolled && { color: colors.text.muted }]}>
                Bien-être
              </Text>
              <Text style={[styles.programDescription, { color: colors.text.tertiary }]}>
                {isWellnessEnrolled
                  ? `Phase ${wellnessPhase} - Semaine ${wellnessWeek}`
                  : wellnessBlockedReason || 'Sommeil, stress et sérénité'}
              </Text>
            </View>
            <Switch
              value={isWellnessEnrolled}
              onValueChange={handleToggleWellness}
              disabled={!canToggleWellness && !isWellnessEnrolled}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(139, 92, 246, 0.3)' }}
              thumbColor={isWellnessEnrolled ? colors.secondary.primary : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </TouchableOpacity>
        </Card>

        {/* Notifications Super Agent */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Notifications IA</Text>
        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          {/* Daily Insights */}
          <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}>
            <Sparkles size={20} color={colors.accent.primary} />
            <View style={styles.notificationInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Insights quotidiens</Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>Conseil personnalisé chaque matin</Text>
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
          <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}>
            <AlertTriangle size={20} color={colors.warning} />
            <View style={styles.notificationInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Alertes santé</Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>Notifications si anomalie détectée</Text>
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
          <View style={styles.settingItem}>
            <Award size={20} color={colors.success} />
            <View style={styles.notificationInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Célébrations</Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>Streaks, badges et objectifs atteints</Text>
            </View>
            <Switch
              value={notificationPreferences.celebrationsEnabled}
              onValueChange={handleToggleCelebrations}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(16, 185, 129, 0.3)' }}
              thumbColor={notificationPreferences.celebrationsEnabled ? colors.success : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>
        </Card>

        {/* Meal Input Methods */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Ajouter un repas</Text>
        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}>
            <Pin size={20} color={colors.accent.primary} />
            <View style={styles.notificationInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Méthodes épinglées</Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]} numberOfLines={1}>
                {pinnedMethodsLabels}
              </Text>
            </View>
            <Text style={[styles.pinnedCount, { color: colors.text.muted }]}>
              {pinnedMethods.length}/4
            </Text>
          </View>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleResetMealInputPreferences}
            activeOpacity={0.7}
          >
            <RotateCcw size={20} color={colors.text.secondary} />
            <Text style={[styles.settingLabel, { flex: 1, color: colors.text.primary }]}>
              Réinitialiser par défaut
            </Text>
            <ChevronRight size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        {/* Meal Source Preference for AI Generation */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Génération IA</Text>
        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          <View style={[styles.settingItem, { paddingBottom: 8 }]}>
            <Sparkles size={20} color={colors.accent.primary} />
            <View style={styles.notificationInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Source des repas</Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                D'où viennent les suggestions du Repas IA
              </Text>
            </View>
          </View>
          <View style={styles.sourcePreferenceGrid}>
            {(Object.keys(mealSourceLabels) as MealSourcePreference[]).map((key) => {
              const pref = mealSourceLabels[key]
              const isSelected = (profile?.mealSourcePreference || 'balanced') === key
              const IconComponent = key === 'fresh' ? Leaf : key === 'recipes' ? ChefHat : key === 'quick' ? ShoppingCart : Database
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.sourcePreferenceItem,
                    { borderColor: isSelected ? colors.accent.primary : colors.border.light },
                    isSelected && { backgroundColor: colors.accent.light },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    updateProfile({ mealSourcePreference: key })
                  }}
                  activeOpacity={0.7}
                >
                  <IconComponent
                    size={20}
                    color={isSelected ? colors.accent.primary : colors.text.secondary}
                  />
                  <Text style={[
                    styles.sourcePreferenceLabel,
                    { color: isSelected ? colors.accent.primary : colors.text.primary }
                  ]}>
                    {pref.label}
                  </Text>
                  <Text style={[styles.sourcePreferenceDesc, { color: colors.text.tertiary }]} numberOfLines={2}>
                    {pref.description}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Card>

        {/* Settings */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Paramètres</Text>
        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          {/* Dark Mode Toggle */}
          <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}>
            {isDark ? (
              <Moon size={20} color={colors.accent.primary} />
            ) : (
              <Sun size={20} color={colors.warning} />
            )}
            <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Mode sombre</Text>
            <Switch
              value={isDark}
              onValueChange={handleToggleDarkMode}
              trackColor={{ false: colors.bg.tertiary, true: colors.accent.light }}
              thumbColor={isDark ? colors.accent.primary : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>
          <SettingItem
            icon={<Shield size={20} color={colors.text.secondary} />}
            label="Confidentialité"
            onPress={() => handleSettingPress('privacy')}
            colors={colors}
          />
          <SettingItem
            icon={<HelpCircle size={20} color={colors.text.secondary} />}
            label="Aide & Support"
            onPress={() => handleSettingPress('help')}
            isLast
            colors={colors}
          />
        </Card>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Button
            variant="ghost"
            onPress={handleLogout}
            icon={<LogOut size={18} color={colors.text.secondary} />}
          >
            Déconnexion
          </Button>
          <TouchableOpacity onPress={handleResetData}>
            <Text style={[styles.resetText, { color: colors.error }]}>Réinitialiser les données</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={[styles.version, { color: colors.text.muted }]}>Presence v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingItem({
  icon,
  label,
  onPress,
  isLast = false,
  colors,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
  isLast?: boolean
  colors: typeof import('../constants/theme').lightColors
}) {
  return (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && [styles.settingItemBorder, { borderBottomColor: colors.border.light }]]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={[styles.settingLabel, { flex: 1, color: colors.text.primary }]}>{label}</Text>
      <ChevronRight size={20} color={colors.text.tertiary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  header: {
    paddingVertical: spacing.default,
  },
  title: {
    ...typography.h2,
  },
  profileCard: {
    marginBottom: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.h4,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    ...typography.bodySemibold,
  },
  profileEmail: {
    ...typography.small,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  editButtonText: {
    ...typography.small,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.bodyMedium,
  },
  statLabel: {
    ...typography.caption,
  },
  statDivider: {
    width: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
  },
  sectionEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalsCard: {
    padding: 0,
    marginBottom: spacing.lg,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    borderBottomWidth: 1,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  goalLabel: {
    ...typography.caption,
  },
  goalValue: {
    ...typography.bodyMedium,
  },
  targetsCard: {
    marginBottom: spacing.lg,
  },
  targetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  targetLabel: {
    ...typography.body,
  },
  targetValue: {
    ...typography.bodySemibold,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    gap: spacing.md,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
  },
  settingLabel: {
    ...typography.body,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationDescription: {
    ...typography.caption,
    marginTop: 2,
  },
  pinnedCount: {
    ...typography.small,
    fontWeight: '500',
  },
  // Source Preference Grid
  sourcePreferenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
    paddingTop: 0,
    gap: spacing.sm,
  },
  sourcePreferenceItem: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sourcePreferenceLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    textAlign: 'center',
  },
  sourcePreferenceDesc: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 16,
  },
  dangerZone: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  resetText: {
    ...typography.small,
  },
  version: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  // Programs
  programItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
  },
  programIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  programIconActive: {
    backgroundColor: '#10B981',
  },
  programIconMetabolic: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  programIconMetabolicActive: {
    backgroundColor: '#F59E0B',
  },
  programIconWellness: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  programIconWellnessActive: {
    backgroundColor: '#FF6B5B',
  },
  programItemBorder: {
    borderBottomWidth: 1,
  },
  programInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  programLabel: {
    ...typography.bodyMedium,
  },
  programLabelDisabled: {
    opacity: 0.5,
  },
  programDescription: {
    ...typography.small,
    marginTop: 2,
  },
  programItemDisabled: {
    opacity: 0.6,
  },
})
