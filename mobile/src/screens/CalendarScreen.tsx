/**
 * CalendarScreen - Vue calendrier avec tous les événements
 *
 * Affiche:
 * - Repas enregistrés par jour
 * - Séances du programme Initiation Sportive
 * - Logs du programme Métabolique
 */

import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Utensils,
  Dumbbell,
  Flame,
  Footprints,
  Moon,
  Droplets,
  X,
} from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

import { Card, Badge } from '../components/ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useMealsStore } from '../stores/meals-store'
import { useMetabolicBoostStore } from '../stores/metabolic-boost-store'
import { useSportInitiationStore } from '../stores/sport-initiation-store'
import { getDateKey } from '../lib/utils'
import type { MealType } from '../types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const DAY_WIDTH = (SCREEN_WIDTH - spacing.default * 2 - spacing.xs * 6) / 7

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  snack: '🍎',
  dinner: '🌙',
}

interface DayData {
  date: Date
  dateKey: string
  isCurrentMonth: boolean
  isToday: boolean
  hasMeals: boolean
  mealCount: number
  hasMetabolicLog: boolean
  hasSportLog: boolean
  metabolicSteps?: number
  sportWorkout?: boolean
}

export default function CalendarScreen() {
  const navigation = useNavigation()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { dailyData, getMealsForDate } = useMealsStore()
  const { dailyLogs: metabolicLogs, isEnrolled: metabolicEnrolled } = useMetabolicBoostStore()
  const { dailyLogs: sportLogs, isEnrolled: sportEnrolled } = useSportInitiationStore()

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    // First day of month
    const firstDay = new Date(year, month, 1)
    // Last day of month
    const lastDay = new Date(year, month + 1, 0)

    // Start from Monday of the week containing the first day
    const startDate = new Date(firstDay)
    const dayOfWeek = firstDay.getDay()
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    startDate.setDate(startDate.getDate() - daysToSubtract)

    // End on Sunday of the week containing the last day
    const endDate = new Date(lastDay)
    const lastDayOfWeek = lastDay.getDay()
    const daysToAdd = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek
    endDate.setDate(endDate.getDate() + daysToAdd)

    const days: DayData[] = []
    const today = getDateKey()

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateKey = getDateKey(currentDate)
      const dayData = dailyData[dateKey]
      const metabolicLog = metabolicLogs.find(l => l.date === dateKey)
      const sportLog = sportLogs.find(l => l.date === dateKey)

      days.push({
        date: new Date(currentDate),
        dateKey,
        isCurrentMonth: currentDate.getMonth() === month,
        isToday: dateKey === today,
        hasMeals: dayData?.meals && dayData.meals.length > 0,
        mealCount: dayData?.meals?.length || 0,
        hasMetabolicLog: !!metabolicLog,
        hasSportLog: !!sportLog,
        metabolicSteps: metabolicLog?.steps,
        sportWorkout: sportLog?.workoutCompleted,
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return days
  }, [currentMonth, dailyData, metabolicLogs, sportLogs])

  // Get selected day details
  const selectedDayDetails = useMemo(() => {
    if (!selectedDate) return null

    const meals = getMealsForDate(selectedDate)
    const metabolicLog = metabolicLogs.find(l => l.date === selectedDate)
    const sportLog = sportLogs.find(l => l.date === selectedDate)
    const dayData = dailyData[selectedDate]

    return {
      meals,
      metabolicLog,
      sportLog,
      hydration: dayData?.hydration || 0,
      totalCalories: dayData?.totalNutrition?.calories || 0,
    }
  }, [selectedDate, getMealsForDate, metabolicLogs, sportLogs, dailyData])

  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCurrentMonth(new Date())
    setSelectedDate(getDateKey())
  }

  const handleDayPress = (day: DayData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedDate(day.dateKey)
  }

  const formatSelectedDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const dayName = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][date.getDay()]
    return `${dayName} ${day} ${MONTHS[month - 1]}`
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Calendrier</Text>
        <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Aujourd'hui</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
            <ChevronLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <ChevronRight size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Weekday Headers */}
        <View style={styles.weekdaysRow}>
          {WEEKDAYS.map(day => (
            <View key={day} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => (
            <TouchableOpacity
              key={day.dateKey}
              style={[
                styles.dayCell,
                !day.isCurrentMonth && styles.dayCellOtherMonth,
                day.isToday && styles.dayCellToday,
                selectedDate === day.dateKey && styles.dayCellSelected,
              ]}
              onPress={() => handleDayPress(day)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayNumber,
                  !day.isCurrentMonth && styles.dayNumberOtherMonth,
                  day.isToday && styles.dayNumberToday,
                  selectedDate === day.dateKey && styles.dayNumberSelected,
                ]}
              >
                {day.date.getDate()}
              </Text>

              {/* Indicators */}
              <View style={styles.indicators}>
                {day.hasMeals && (
                  <View style={[styles.indicator, styles.indicatorMeals]} />
                )}
                {day.hasMetabolicLog && metabolicEnrolled && (
                  <View style={[styles.indicator, styles.indicatorMetabolic]} />
                )}
                {day.hasSportLog && sportEnrolled && (
                  <View style={[styles.indicator, styles.indicatorSport]} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.indicatorMeals]} />
            <Text style={styles.legendText}>Repas</Text>
          </View>
          {metabolicEnrolled && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.indicatorMetabolic]} />
              <Text style={styles.legendText}>Métabolique</Text>
            </View>
          )}
          {sportEnrolled && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.indicatorSport]} />
              <Text style={styles.legendText}>Sport</Text>
            </View>
          )}
        </View>

        {/* Selected Day Details */}
        {selectedDate && selectedDayDetails && (
          <View style={styles.detailsSection}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>{formatSelectedDate(selectedDate)}</Text>
              <TouchableOpacity onPress={() => setSelectedDate(null)}>
                <X size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {/* Meals */}
            {selectedDayDetails.meals.length > 0 ? (
              <Card style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Utensils size={18} color={colors.accent.primary} />
                  <Text style={styles.detailCardTitle}>Repas</Text>
                  <Badge variant="default" size="sm">
                    {selectedDayDetails.totalCalories} kcal
                  </Badge>
                </View>
                {selectedDayDetails.meals.map(meal => (
                  <View key={meal.id} style={styles.mealItem}>
                    <Text style={styles.mealEmoji}>{MEAL_ICONS[meal.type]}</Text>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealType}>
                        {meal.type === 'breakfast' ? 'Petit-déj' :
                         meal.type === 'lunch' ? 'Déjeuner' :
                         meal.type === 'snack' ? 'Collation' : 'Dîner'}
                      </Text>
                      <Text style={styles.mealDetails}>
                        {meal.items.length} aliment{meal.items.length > 1 ? 's' : ''} · {meal.totalNutrition.calories} kcal
                      </Text>
                    </View>
                    <Text style={styles.mealTime}>{meal.time}</Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Card style={styles.detailCard}>
                <View style={styles.emptyState}>
                  <Utensils size={24} color={colors.text.muted} />
                  <Text style={styles.emptyText}>Aucun repas enregistré</Text>
                </View>
              </Card>
            )}

            {/* Metabolic Log */}
            {metabolicEnrolled && selectedDayDetails.metabolicLog && (
              <Card style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Flame size={18} color={colors.warning} />
                  <Text style={styles.detailCardTitle}>Programme Métabolique</Text>
                </View>
                <View style={styles.statsGrid}>
                  {selectedDayDetails.metabolicLog.steps !== undefined && (
                    <View style={styles.statItem}>
                      <Footprints size={16} color={colors.success} />
                      <Text style={styles.statValue}>{selectedDayDetails.metabolicLog.steps}</Text>
                      <Text style={styles.statLabel}>pas</Text>
                    </View>
                  )}
                  {selectedDayDetails.metabolicLog.sleepHours !== undefined && (
                    <View style={styles.statItem}>
                      <Moon size={16} color={colors.secondary.primary} />
                      <Text style={styles.statValue}>{selectedDayDetails.metabolicLog.sleepHours}h</Text>
                      <Text style={styles.statLabel}>sommeil</Text>
                    </View>
                  )}
                  {selectedDayDetails.metabolicLog.walkingMinutes !== undefined && (
                    <View style={styles.statItem}>
                      <Dumbbell size={16} color={colors.accent.primary} />
                      <Text style={styles.statValue}>{selectedDayDetails.metabolicLog.walkingMinutes}</Text>
                      <Text style={styles.statLabel}>min marche</Text>
                    </View>
                  )}
                </View>
              </Card>
            )}

            {/* Sport Log */}
            {sportEnrolled && selectedDayDetails.sportLog && (
              <Card style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Dumbbell size={18} color={colors.success} />
                  <Text style={styles.detailCardTitle}>Initiation Sportive</Text>
                  {selectedDayDetails.sportLog.workoutCompleted && (
                    <Badge variant="success" size="sm">Séance faite</Badge>
                  )}
                </View>
                <View style={styles.statsGrid}>
                  {selectedDayDetails.sportLog.steps !== undefined && (
                    <View style={styles.statItem}>
                      <Footprints size={16} color={colors.success} />
                      <Text style={styles.statValue}>{selectedDayDetails.sportLog.steps}</Text>
                      <Text style={styles.statLabel}>pas</Text>
                    </View>
                  )}
                  {selectedDayDetails.sportLog.activeMinutes !== undefined && (
                    <View style={styles.statItem}>
                      <Flame size={16} color={colors.warning} />
                      <Text style={styles.statValue}>{selectedDayDetails.sportLog.activeMinutes}</Text>
                      <Text style={styles.statLabel}>min actives</Text>
                    </View>
                  )}
                </View>
              </Card>
            )}

            {/* Hydration */}
            {selectedDayDetails.hydration > 0 && (
              <Card style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <Droplets size={18} color={colors.info} />
                  <Text style={styles.detailCardTitle}>Hydratation</Text>
                  <Text style={styles.hydrationValue}>{selectedDayDetails.hydration} ml</Text>
                </View>
              </Card>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  todayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accent.light,
    borderRadius: radius.full,
  },
  todayButtonText: {
    ...typography.small,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
  },
  navButton: {
    padding: spacing.sm,
  },
  monthTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  weekdaysRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    marginBottom: spacing.sm,
  },
  weekdayCell: {
    width: DAY_WIDTH,
    alignItems: 'center',
    marginHorizontal: spacing.xs / 2,
  },
  weekdayText: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.default,
  },
  dayCell: {
    width: DAY_WIDTH,
    height: DAY_WIDTH + 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xs,
    marginHorizontal: spacing.xs / 2,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
  },
  dayCellOtherMonth: {
    opacity: 0.3,
  },
  dayCellToday: {
    backgroundColor: colors.accent.light,
  },
  dayCellSelected: {
    backgroundColor: colors.accent.primary,
  },
  dayNumber: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  dayNumberOtherMonth: {
    color: colors.text.muted,
  },
  dayNumberToday: {
    color: colors.accent.primary,
    fontWeight: '700',
  },
  dayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  indicators: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  indicatorMeals: {
    backgroundColor: colors.accent.primary,
  },
  indicatorMetabolic: {
    backgroundColor: colors.warning,
  },
  indicatorSport: {
    backgroundColor: colors.success,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginHorizontal: spacing.default,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  detailsSection: {
    padding: spacing.default,
    gap: spacing.md,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailsTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  detailCard: {
    marginBottom: 0,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailCardTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  mealEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  mealInfo: {
    flex: 1,
  },
  mealType: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  mealDetails: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  mealTime: {
    ...typography.small,
    color: colors.text.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
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
  hydrationValue: {
    ...typography.bodyMedium,
    color: colors.info,
  },
  bottomSpacer: {
    height: spacing['3xl'],
  },
})
