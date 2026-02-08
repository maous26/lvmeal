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
  Target,
  Scale,
  Activity,
  Utensils,
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
  Pin,
  Database,
  TrendingUp,
  Crown,
  Ruler,
  Trash2,
} from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import { Card, Button, AnimatedBackground } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, fonts } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMetabolicBoostStore } from '../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../stores/wellness-program-store'
import { formatNumber } from '../lib/utils'
import type { RootStackParamList } from '../navigation/RootNavigator'
import {
  useMealInputPreferencesStore,
  ALL_INPUT_METHODS,
} from '../stores/meal-input-preferences-store'
import { useAuthStore } from '../stores/auth-store'
import { useOnboardingStore } from '../stores/onboarding-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useSubscriptionStore } from '../stores/subscription-store'
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

// Labels synchronisés avec l'onboarding - 3 objectifs principaux
// Les anciennes valeurs (maintain, maintenance, energy) sont mappées vers health
const goalLabels: Record<string, string> = {
  weight_loss: 'Perdre du poids',
  lose: 'Perdre du poids',
  muscle_gain: 'Prendre du muscle',
  muscle: 'Prendre du muscle',
  gain: 'Prendre du muscle',
  health: 'Améliorer ma santé',
  // Legacy mappings -> health
  maintain: 'Améliorer ma santé',
  maintenance: 'Améliorer ma santé',
  energy: 'Améliorer ma santé',
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
  const { profile, nutritionGoals, resetStore, updateProfile, notificationPreferences, updateNotificationPreferences } = useUserStore()
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

  // Get email from auth store (Google login stores email there, not in profile)
  const { email: authEmail } = useAuthStore()

  // Subscription status
  const { isSubscribed } = useOnboardingStore()
  const { isPremium } = useSubscriptionStore()

  // Calculate BMI (IMC)
  const calculateBMI = (): { value: number; category: string; color: string } | null => {
    const weight = profile?.weight
    const height = profile?.height
    if (!weight || !height) return null

    const heightInMeters = height / 100
    const bmi = weight / (heightInMeters * heightInMeters)

    let category: string
    let color: string
    if (bmi < 18.5) {
      category = 'Insuffisance pondérale'
      color = colors.warning
    } else if (bmi < 25) {
      category = 'Poids normal'
      color = colors.success
    } else if (bmi < 30) {
      category = 'Surpoids'
      color = colors.warning
    } else {
      category = 'Obésité'
      color = colors.error
    }

    return { value: Math.round(bmi * 10) / 10, category, color }
  }

  const bmiData = calculateBMI()

  // Subscription type label
  const getSubscriptionLabel = (): { label: string; color: string } => {
    if (isPremium || isSubscribed) {
      return { label: 'Premium (Bêta)', color: colors.warning }
    }
    return { label: 'Gratuit', color: colors.text.tertiary }
  }

  const subscriptionInfo = getSubscriptionLabel()

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
      'Es-tu sûr de vouloir te déconnecter ? Tu retourneras à l\'écran d\'onboarding.',
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
      'Cette action supprimera toutes tes données. Cette action est irréversible.',
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

  const handleDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    Alert.alert(
      'Supprimer mon compte',
      'Cette action supprimera définitivement ton compte et toutes tes données. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            // Confirmation supplémentaire pour éviter les suppressions accidentelles
            Alert.alert(
              'Confirmer la suppression',
              'Es-tu vraiment sûr ? Toutes tes données seront perdues à jamais.',
              [
                { text: 'Non, annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer',
                  style: 'destructive',
                  onPress: async () => {
                    // TODO: Appeler l'API de suppression de compte quand elle sera implémentée
                    // Pour l'instant, on réinitialise toutes les données locales
                    resetStore()
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  },
                },
              ]
            )
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

  // Get pinned methods labels for display
  const pinnedMethodsLabels = pinnedMethods
    .map(id => ALL_INPUT_METHODS.find(m => m.id === id)?.labelShort || id)
    .join(', ')

  const handleToggleMetabolic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (isMetabolicEnrolled) {
      Alert.alert(
        'Quitter le programme',
        'Es-tu sûr de vouloir quitter le programme Métabolisme ? Ta progression sera conservée.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Quitter',
            style: 'destructive',
            onPress: () => {
              unenrollMetabolic()
              // Use updateProfile to avoid resetting isOnboarded
              updateProfile({ metabolicProgramActive: false })
            },
          },
        ]
      )
    } else {
      Alert.alert(
        'Rejoindre le programme',
        'Le programme Métabolisme t\'aide à relancer ton métabolisme en douceur sur 9 semaines.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Commencer',
            onPress: () => {
              enrollMetabolic()
              // Use updateProfile to avoid resetting isOnboarded
              updateProfile({ metabolicProgramActive: true })
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
        'Es-tu sûr de vouloir quitter le programme Bien-être ? Ta progression sera conservée.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Quitter',
            style: 'destructive',
            onPress: () => {
              unenrollWellness()
              // Use updateProfile to avoid resetting isOnboarded
              updateProfile({ wellnessProgramActive: false })
            },
          },
        ]
      )
    } else {
      Alert.alert(
        'Rejoindre le programme',
        'Le programme Bien-être t\'accompagne pour améliorer ton sommeil, gérer le stress et cultiver la sérénité sur 8 semaines.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Commencer',
            onPress: () => {
              enrollWellness()
              // Use updateProfile to avoid resetting isOnboarded
              updateProfile({ wellnessProgramActive: true })
            },
          },
        ]
      )
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <AnimatedBackground circleCount={4} intensity={0.06} />
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
              <Text style={[styles.profileEmail, { color: colors.text.tertiary }]}>{profile?.email || authEmail || 'Aucun email'}</Text>
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
              <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>Série</Text>
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

        {/* Subscription Card */}
        <TouchableOpacity
          style={[
            styles.subscriptionCard,
            {
              backgroundColor: isPremium || isSubscribed
                ? 'rgba(245, 158, 11, 0.1)'
                : colors.bg.elevated,
              borderColor: isPremium || isSubscribed
                ? colors.warning
                : colors.border.light,
            },
          ]}
          onPress={() => {
            if (!(isPremium || isSubscribed)) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              navigation.navigate('Paywall')
            }
          }}
          activeOpacity={isPremium || isSubscribed ? 1 : 0.7}
        >
          <View style={[
            styles.subscriptionIcon,
            {
              backgroundColor: isPremium || isSubscribed
                ? 'rgba(245, 158, 11, 0.2)'
                : colors.bg.secondary,
            },
          ]}>
            <Crown size={24} color={isPremium || isSubscribed ? colors.warning : colors.text.tertiary} />
          </View>
          <View style={styles.subscriptionInfo}>
            <Text style={[
              styles.subscriptionTitle,
              { color: isPremium || isSubscribed ? colors.warning : colors.text.primary },
            ]}>
              {isPremium || isSubscribed ? 'Premium (Bêta)' : 'Gratuit'}
            </Text>
            <Text style={[styles.subscriptionSubtitle, { color: colors.text.tertiary }]}>
              {isPremium || isSubscribed
                ? 'Accès illimité à toutes les fonctionnalités'
                : 'Passez en Premium pour débloquer tout'}
            </Text>
          </View>
          {!(isPremium || isSubscribed) && (
            <View style={[styles.upgradeButton, { backgroundColor: colors.warning }]}>
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Mes informations */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Mes informations</Text>
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

          {/* IMC - information calculée */}
          {bmiData && (
            <View style={[styles.goalItem, { borderBottomColor: colors.border.light }]}>
              <View style={[styles.goalIcon, { backgroundColor: colors.bg.secondary }]}>
                <Ruler size={20} color={bmiData.color} />
              </View>
              <View style={styles.goalInfo}>
                <Text style={[styles.goalLabel, { color: colors.text.tertiary }]}>IMC</Text>
                <Text style={[styles.goalValue, { color: colors.text.primary }]}>
                  {bmiData.value} <Text style={{ color: bmiData.color, fontSize: 14 }}>({bmiData.category})</Text>
                </Text>
              </View>
            </View>
          )}

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

        {/* Progress Link */}
        <TouchableOpacity
          style={[styles.progressLink, { backgroundColor: colors.bg.elevated }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            navigation.navigate('Progress')
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.progressLinkIcon, { backgroundColor: colors.accent.light }]}>
            <TrendingUp size={22} color={colors.accent.primary} />
          </View>
          <View style={styles.progressLinkInfo}>
            <Text style={[styles.progressLinkTitle, { color: colors.text.primary }]}>Mes Progrès</Text>
            <Text style={[styles.progressLinkSubtitle, { color: colors.text.tertiary }]}>
              Poids, nutrition, XP et badges
            </Text>
          </View>
          <ChevronRight size={20} color={colors.accent.primary} />
        </TouchableOpacity>

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
              <Zap size={20} color={isMetabolicEnrolled ? '#FFFFFF' : '#C87863'} />
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
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(200, 120, 99, 0.3)' }}
              thumbColor={isMetabolicEnrolled ? '#C87863' : colors.text.tertiary}
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
              <Heart size={20} color={isWellnessEnrolled ? '#FFFFFF' : '#4A6741'} />
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
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(74, 103, 65, 0.3)' }}
              thumbColor={isWellnessEnrolled ? '#4A6741' : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </TouchableOpacity>
        </Card>

        {/* Settings - Consolidated */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Paramètres</Text>
        <Card padding="none" style={{ backgroundColor: colors.bg.elevated, marginBottom: spacing.lg }}>
          {/* Notification Settings */}
          <TouchableOpacity
            style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('NotificationSettings')
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <BellRing size={20} color={colors.warning} />
            </View>
            <View style={styles.notificationInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Notifications IA</Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                Insights, alertes et célébrations
              </Text>
            </View>
            <ChevronRight size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* Meal Input Settings */}
          <TouchableOpacity
            style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('MealInputSettings')
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Pin size={20} color={colors.success} />
            </View>
            <View style={styles.notificationInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Ajouter un repas</Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                {pinnedMethodsLabels} ({pinnedMethods.length}/4)
              </Text>
            </View>
            <ChevronRight size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* Meal Source Settings - HIDDEN for now
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('MealSourceSettings')
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIconContainer, { backgroundColor: 'rgba(122, 158, 126, 0.1)' }]}>
              <Database size={20} color={colors.accent.primary} />
            </View>
            <View style={styles.notificationInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Sources de repas</Text>
              <Text style={[styles.notificationDescription, { color: colors.text.tertiary }]}>
                {mealSourceLabels[profile?.mealSourcePreference || 'balanced'].label}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
          */}
        </Card>

        {/* App Settings */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Application</Text>
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
            <Text style={[styles.resetText, { color: colors.text.tertiary }]}>Réinitialiser les données</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={styles.deleteAccountButton}
          >
            <Trash2 size={16} color={colors.error} />
            <Text style={[styles.deleteAccountText, { color: colors.error }]}>Supprimer mon compte</Text>
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
    fontFamily: fonts.serif.bold,
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
    fontFamily: fonts.serif.semibold,
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
    fontFamily: fonts.serif.semibold,
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
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  deleteAccountText: {
    ...typography.small,
    fontWeight: '500',
  },
  // Subscription Card
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  subscriptionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  subscriptionSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  upgradeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  upgradeButtonText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
    fontWeight: '600',
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
    backgroundColor: 'rgba(200, 120, 99, 0.15)',  // Terre Cuite light
  },
  programIconMetabolicActive: {
    backgroundColor: '#C87863',  // Terre Cuite
  },
  programIconWellness: {
    backgroundColor: 'rgba(74, 103, 65, 0.15)',   // Vert Mousse light
  },
  programIconWellnessActive: {
    backgroundColor: '#4A6741',  // Vert Mousse
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
  // Settings icon container
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Progress Link
  progressLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  progressLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressLinkInfo: {
    flex: 1,
  },
  progressLinkTitle: {
    ...typography.bodyMedium,
    fontFamily: fonts.serif.semibold,
  },
  progressLinkSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
})
