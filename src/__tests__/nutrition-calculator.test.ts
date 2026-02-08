/**
 * Tests for the unified nutritional needs calculator
 * Verifies Harris-Benedict BMR, TDEE, and macro distribution
 */
import { calculateNutritionalNeeds } from '../stores/user-store'

describe('calculateNutritionalNeeds', () => {
  describe('returns null for incomplete profiles', () => {
    it('returns null when weight is missing', () => {
      expect(calculateNutritionalNeeds({ height: 170, age: 30 })).toBeNull()
    })

    it('returns null when height is missing', () => {
      expect(calculateNutritionalNeeds({ weight: 70, age: 30 })).toBeNull()
    })

    it('returns null when age is missing', () => {
      expect(calculateNutritionalNeeds({ weight: 70, height: 170 })).toBeNull()
    })
  })

  describe('BMR calculation (Harris-Benedict)', () => {
    it('calculates male BMR correctly', () => {
      const result = calculateNutritionalNeeds({
        weight: 80, height: 180, age: 30, gender: 'male',
        activityLevel: 'sedentary', goal: 'maintenance',
      })
      expect(result).not.toBeNull()
      // Male BMR = 88.362 + (13.397 * 80) + (4.799 * 180) - (5.677 * 30)
      // = 88.362 + 1071.76 + 863.82 - 170.31 = 1853.632
      // TDEE = 1853.632 * 1.2 = 2224.36
      expect(result!.calories).toBe(Math.round(1853.632 * 1.2))
    })

    it('calculates female BMR correctly', () => {
      const result = calculateNutritionalNeeds({
        weight: 60, height: 165, age: 25, gender: 'female',
        activityLevel: 'sedentary', goal: 'maintenance',
      })
      expect(result).not.toBeNull()
      // Female BMR = 447.593 + (9.247 * 60) + (3.098 * 165) - (4.330 * 25)
      // = 447.593 + 554.82 + 511.17 - 108.25 = 1405.333
      // TDEE = 1405.333 * 1.2 = 1686.4
      expect(result!.calories).toBe(Math.round(1405.333 * 1.2))
    })
  })

  describe('goal adjustments', () => {
    const baseProfile = { weight: 70, height: 170, age: 30, gender: 'male' as const, activityLevel: 'moderate' as const }

    it('applies -400 kcal deficit for standard weight loss', () => {
      const maintenance = calculateNutritionalNeeds({ ...baseProfile, goal: 'maintenance' })
      const weightLoss = calculateNutritionalNeeds({ ...baseProfile, goal: 'weight_loss' })
      expect(maintenance!.calories - weightLoss!.calories).toBe(400)
    })

    it('applies +300 kcal surplus for standard muscle gain', () => {
      const maintenance = calculateNutritionalNeeds({ ...baseProfile, goal: 'maintenance' })
      const muscleGain = calculateNutritionalNeeds({ ...baseProfile, goal: 'muscle_gain' })
      expect(muscleGain!.calories - maintenance!.calories).toBe(300)
    })

    it('applies only -100 kcal deficit for adaptive weight loss', () => {
      const maintenance = calculateNutritionalNeeds({ ...baseProfile, goal: 'maintenance', metabolismProfile: 'adaptive' })
      const weightLoss = calculateNutritionalNeeds({ ...baseProfile, goal: 'weight_loss', metabolismProfile: 'adaptive' })
      expect(maintenance!.calories - weightLoss!.calories).toBe(100)
    })

    it('applies +200 kcal surplus for adaptive muscle gain', () => {
      const maintenance = calculateNutritionalNeeds({ ...baseProfile, goal: 'maintenance', metabolismProfile: 'adaptive' })
      const muscleGain = calculateNutritionalNeeds({ ...baseProfile, goal: 'muscle_gain', metabolismProfile: 'adaptive' })
      expect(muscleGain!.calories - maintenance!.calories).toBe(200)
    })
  })

  describe('macro distribution', () => {
    it('calculates standard macros (25% fat)', () => {
      const result = calculateNutritionalNeeds({
        weight: 70, height: 170, age: 30, gender: 'male',
        activityLevel: 'moderate', goal: 'maintenance',
      })
      expect(result).not.toBeNull()
      // Protein: 70 * 1.6 = 112g
      expect(result!.proteins).toBe(112)
      // Fat: (calories * 0.25) / 9
      expect(result!.fats).toBe(Math.round((result!.calories * 0.25) / 9))
    })

    it('calculates adaptive macros (30% fat, 2.0g/kg protein)', () => {
      const result = calculateNutritionalNeeds({
        weight: 70, height: 170, age: 30, gender: 'male',
        activityLevel: 'moderate', goal: 'maintenance',
        metabolismProfile: 'adaptive',
      })
      expect(result).not.toBeNull()
      // Protein: 70 * 2.0 = 140g
      expect(result!.proteins).toBe(140)
      // Fat: (calories * 0.30) / 9
      expect(result!.fats).toBe(Math.round((result!.calories * 0.30) / 9))
    })
  })

  describe('micronutrients', () => {
    it('provides gender-specific iron values', () => {
      const male = calculateNutritionalNeeds({
        weight: 70, height: 170, age: 30, gender: 'male',
        activityLevel: 'moderate', goal: 'maintenance',
      })
      const female = calculateNutritionalNeeds({
        weight: 60, height: 165, age: 30, gender: 'female',
        activityLevel: 'moderate', goal: 'maintenance',
      })
      expect(male!.iron).toBe(8)
      expect(female!.iron).toBe(18)
    })

    it('includes all ANSES micronutrients', () => {
      const result = calculateNutritionalNeeds({
        weight: 70, height: 170, age: 30, gender: 'male',
        activityLevel: 'moderate', goal: 'maintenance',
      })
      expect(result!.fiber).toBe(30)
      expect(result!.water).toBe(2.5)
      expect(result!.calcium).toBe(1000)
      expect(result!.vitaminD).toBe(600)
      expect(result!.vitaminC).toBe(90)
      expect(result!.vitaminB12).toBe(2.4)
      expect(result!.zinc).toBe(11)
      expect(result!.magnesium).toBe(400)
      expect(result!.potassium).toBe(3500)
      expect(result!.omega3).toBe(1.6)
    })
  })

  describe('activity level multipliers', () => {
    const baseProfile = { weight: 70, height: 170, age: 30, gender: 'male' as const, goal: 'maintenance' as const }

    it('sedentary is lower than active', () => {
      const sedentary = calculateNutritionalNeeds({ ...baseProfile, activityLevel: 'sedentary' })
      const active = calculateNutritionalNeeds({ ...baseProfile, activityLevel: 'active' })
      expect(sedentary!.calories).toBeLessThan(active!.calories)
    })

    it('athlete has highest calories', () => {
      const moderate = calculateNutritionalNeeds({ ...baseProfile, activityLevel: 'moderate' })
      const athlete = calculateNutritionalNeeds({ ...baseProfile, activityLevel: 'athlete' })
      expect(athlete!.calories).toBeGreaterThan(moderate!.calories)
    })
  })
})
