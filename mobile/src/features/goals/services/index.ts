/**
 * Goals Services Index
 */

export { calculateDiversity, detectFoodGroup, getDiversityLevelLabel, getDiversityMessage } from './diversity-calculator'
export { detectEnergySignals, hasActiveEnergySignals, getEnergySignalMessage, estimateNovaGroup } from './energy-signals'
export { calculateWeeklySummary, createNutritionRanges, checkRangePosition, getRangePositionLabel, generateNutritionInsights } from './nutrition-insights'
export { requestAdvice, getSupplementationInfo, buildAdviceContext } from './recommendations-service'
export * from './goals-analytics'
