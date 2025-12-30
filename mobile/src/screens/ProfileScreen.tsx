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
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Award,
  Flame,
  Dumbbell,
  Zap,
  Heart,
  Edit3,
} from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Haptics from 'expo-haptics'

import { Card, Badge, ProgressBar, Button } from '../components/ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useSportInitiationStore } from '../stores/sport-initiation-store'
import { useMetabolicBoostStore } from '../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../stores/wellness-program-store'
import { formatNumber } from '../lib/utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

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
  const { profile, nutritionGoals, resetStore, setProfile } = useUserStore()
  const {
    isEnrolled: isSportInitiationEnrolled,
    enroll: enrollSportInitiation,
    unenroll: unenrollSportInitiation,
    currentPhase: sportPhase,
    currentWeek: sportWeek,
  } = useSportInitiationStore()

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

  // Profile conditions
  const isMuscleGain = profile?.goal === 'muscle_gain'

  // Program exclusion rules - ALL programs always visible but some may be disabled
  // - Sport: disabled if muscle_gain OR if Metabolic is active
  // - Metabolic: disabled if Sport OR Wellness is active (exclusive program)
  // - Wellness: disabled if Metabolic is active
  const canToggleSport = !isMuscleGain && !isMetabolicEnrolled
  const canToggleMetabolic = !isSportInitiationEnrolled && !isWellnessEnrolled
  const canToggleWellness = !isMetabolicEnrolled

  // Blocking reasons for UI feedback
  const sportBlockedReason = isMuscleGain
    ? 'Non disponible pour la prise de masse'
    : isMetabolicEnrolled
      ? 'Désactivez le programme Métabolisme d\'abord'
      : null
  const metabolicBlockedReason = isSportInitiationEnrolled
    ? 'Désactivez le programme Sport d\'abord'
    : isWellnessEnrolled
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

  const handleToggleSportInitiation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (isSportInitiationEnrolled) {
      Alert.alert(
        'Quitter le programme',
        'Êtes-vous sûr de vouloir quitter le programme d\'initiation sportive ? Votre progression sera conservée.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Quitter',
            style: 'destructive',
            onPress: () => {
              unenrollSportInitiation()
              if (profile) {
                setProfile({ ...profile, sportInitiationActive: false })
              }
            },
          },
        ]
      )
    } else {
      Alert.alert(
        'Rejoindre le programme',
        'Le programme d\'initiation sportive vous accompagne pour reprendre le sport en douceur sur 12 semaines.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Commencer',
            onPress: () => {
              enrollSportInitiation({
                fitnessLevel: 'sedentary',
                hasHealthConditions: false,
                preferredActivities: ['walking', 'stretching'],
                availableMinutesPerDay: 15,
              })
              if (profile) {
                setProfile({ ...profile, sportInitiationActive: true })
              }
            },
          },
        ]
      )
    }
  }

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
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileEmail}>{profile?.email || 'Aucun email'}</Text>
            </View>
            <TouchableOpacity onPress={handleEditProfile} style={styles.editButton}>
              <Edit3 size={18} color={colors.accent.primary} />
              <Text style={styles.editButtonText}>Modifier</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Flame size={20} color={colors.warning} />
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Award size={20} color={colors.accent.primary} />
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>Badges</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Activity size={20} color={colors.success} />
              <Text style={styles.statValue}>Niv. 3</Text>
              <Text style={styles.statLabel}>Niveau</Text>
            </View>
          </View>
        </Card>

        {/* Current Goals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes objectifs</Text>
          <TouchableOpacity onPress={handleEditProfile} style={styles.sectionEditButton}>
            <Edit3 size={16} color={colors.accent.primary} />
          </TouchableOpacity>
        </View>
        <Card style={styles.goalsCard}>
          <View style={styles.goalItem}>
            <View style={styles.goalIcon}>
              <Target size={20} color={colors.accent.primary} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={styles.goalLabel}>Objectif</Text>
              <Text style={styles.goalValue}>
                {goalLabels[profile?.goal || 'maintain']}
              </Text>
            </View>
          </View>

          <View style={styles.goalItem}>
            <View style={styles.goalIcon}>
              <Scale size={20} color={colors.secondary.primary} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={styles.goalLabel}>Poids actuel</Text>
              <Text style={styles.goalValue}>
                {profile?.weight || 70} kg
                {profile?.targetWeight && ` → ${profile.targetWeight} kg`}
              </Text>
            </View>
          </View>

          <View style={styles.goalItem}>
            <View style={styles.goalIcon}>
              <Activity size={20} color={colors.success} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={styles.goalLabel}>Niveau d'activité</Text>
              <Text style={styles.goalValue}>
                {activityLabels[profile?.activityLevel || 'moderate']}
              </Text>
            </View>
          </View>

          <View style={[styles.goalItem, { borderBottomWidth: 0 }]}>
            <View style={styles.goalIcon}>
              <Utensils size={20} color={colors.nutrients.carbs} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={styles.goalLabel}>Régime alimentaire</Text>
              <Text style={styles.goalValue}>
                {dietLabels[profile?.dietType || 'omnivore']}
              </Text>
            </View>
          </View>
        </Card>

        {/* Daily Targets */}
        <Text style={styles.sectionTitle}>Objectifs journaliers</Text>
        <Card style={styles.targetsCard}>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Calories</Text>
            <Text style={styles.targetValue}>
              {formatNumber(nutritionGoals?.calories || 2000)} kcal
            </Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Protéines</Text>
            <Text style={[styles.targetValue, { color: colors.nutrients.proteins }]}>
              {nutritionGoals?.proteins || 100}g
            </Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Glucides</Text>
            <Text style={[styles.targetValue, { color: colors.nutrients.carbs }]}>
              {nutritionGoals?.carbs || 250}g
            </Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Lipides</Text>
            <Text style={[styles.targetValue, { color: colors.nutrients.fats }]}>
              {nutritionGoals?.fats || 67}g
            </Text>
          </View>
        </Card>

        {/* Programs - Always show all 3, disable switches when blocked */}
        <Text style={styles.sectionTitle}>Programmes</Text>
        <Card padding="none">
          {/* Sport - disabled if muscle_gain or Metabolic active */}
          <TouchableOpacity
            style={[styles.programItem, styles.programItemBorder, !canToggleSport && !isSportInitiationEnrolled && styles.programItemDisabled]}
            onPress={canToggleSport || isSportInitiationEnrolled ? handleToggleSportInitiation : undefined}
            activeOpacity={canToggleSport || isSportInitiationEnrolled ? 0.7 : 1}
          >
            <View style={[styles.programIcon, isSportInitiationEnrolled && styles.programIconActive]}>
              <Dumbbell size={20} color={isSportInitiationEnrolled ? '#FFFFFF' : colors.success} />
            </View>
            <View style={styles.programInfo}>
              <Text style={[styles.programLabel, !canToggleSport && !isSportInitiationEnrolled && styles.programLabelDisabled]}>
                Initiation Sportive
              </Text>
              <Text style={styles.programDescription}>
                {isSportInitiationEnrolled
                  ? `Phase ${sportPhase} - Semaine ${sportWeek}`
                  : sportBlockedReason || 'Programme pour reprendre le sport'}
              </Text>
            </View>
            <Switch
              value={isSportInitiationEnrolled}
              onValueChange={handleToggleSportInitiation}
              disabled={!canToggleSport && !isSportInitiationEnrolled}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(16, 185, 129, 0.3)' }}
              thumbColor={isSportInitiationEnrolled ? colors.success : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </TouchableOpacity>

          {/* Métabolisme - disabled if Sport or Wellness active */}
          <TouchableOpacity
            style={[styles.programItem, styles.programItemBorder, !canToggleMetabolic && !isMetabolicEnrolled && styles.programItemDisabled]}
            onPress={canToggleMetabolic || isMetabolicEnrolled ? handleToggleMetabolic : undefined}
            activeOpacity={canToggleMetabolic || isMetabolicEnrolled ? 0.7 : 1}
          >
            <View style={[styles.programIcon, styles.programIconMetabolic, isMetabolicEnrolled && styles.programIconMetabolicActive]}>
              <Zap size={20} color={isMetabolicEnrolled ? '#FFFFFF' : colors.warning} />
            </View>
            <View style={styles.programInfo}>
              <Text style={[styles.programLabel, !canToggleMetabolic && !isMetabolicEnrolled && styles.programLabelDisabled]}>
                Métabolisme
              </Text>
              <Text style={styles.programDescription}>
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
              <Text style={[styles.programLabel, !canToggleWellness && !isWellnessEnrolled && styles.programLabelDisabled]}>
                Bien-être
              </Text>
              <Text style={styles.programDescription}>
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

        {/* Settings */}
        <Text style={styles.sectionTitle}>Paramètres</Text>
        <Card padding="none">
          <SettingItem
            icon={<Bell size={20} color={colors.text.secondary} />}
            label="Notifications"
            onPress={() => handleSettingPress('notifications')}
          />
          <SettingItem
            icon={<Shield size={20} color={colors.text.secondary} />}
            label="Confidentialité"
            onPress={() => handleSettingPress('privacy')}
          />
          <SettingItem
            icon={<HelpCircle size={20} color={colors.text.secondary} />}
            label="Aide & Support"
            onPress={() => handleSettingPress('help')}
            isLast
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
            <Text style={styles.resetText}>Réinitialiser les données</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={styles.version}>Presence v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingItem({
  icon,
  label,
  onPress,
  isLast = false,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
  isLast?: boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && styles.settingItemBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={styles.settingLabel}>{label}</Text>
      <ChevronRight size={20} color={colors.text.tertiary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
    color: colors.text.primary,
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
    backgroundColor: colors.accent.primary,
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
    color: colors.text.primary,
  },
  profileEmail: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent.light,
    borderRadius: radius.md,
  },
  editButtonText: {
    ...typography.small,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
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
    color: colors.text.secondary,
  },
  sectionEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent.light,
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
    borderBottomColor: colors.border.light,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  goalLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  goalValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
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
    color: colors.text.secondary,
  },
  targetValue: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    gap: spacing.md,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  settingLabel: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  dangerZone: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  resetText: {
    ...typography.small,
    color: colors.error,
  },
  version: {
    ...typography.caption,
    color: colors.text.muted,
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
    backgroundColor: colors.success,
  },
  programIconMetabolic: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  programIconMetabolicActive: {
    backgroundColor: colors.warning,
  },
  programIconWellness: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  programIconWellnessActive: {
    backgroundColor: colors.secondary.primary,
  },
  programItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  programInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  programLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  programLabelDisabled: {
    color: colors.text.muted,
  },
  programDescription: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  programItemDisabled: {
    opacity: 0.6,
  },
})
