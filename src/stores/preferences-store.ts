import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EnergyUnit = 'kcal' | 'kJ'
export type WeightUnit = 'kg' | 'lbs'
export type HeightUnit = 'cm' | 'inches'
export type WaterUnit = 'ml' | 'oz'

// Conversion factors
const KCAL_TO_KJ = 4.184
const KG_TO_LBS = 2.20462
const CM_TO_INCHES = 0.393701
const ML_TO_OZ = 0.033814

interface PreferencesState {
  // Units
  energyUnit: EnergyUnit
  weightUnit: WeightUnit
  heightUnit: HeightUnit
  waterUnit: WaterUnit

  // Actions
  setEnergyUnit: (unit: EnergyUnit) => void
  setWeightUnit: (unit: WeightUnit) => void
  setHeightUnit: (unit: HeightUnit) => void
  setWaterUnit: (unit: WaterUnit) => void

  // Conversion helpers
  formatEnergy: (kcal: number) => string
  formatWeight: (kg: number) => string
  formatHeight: (cm: number) => string
  formatWater: (ml: number) => string
  convertToKcal: (value: number) => number
  convertToKg: (value: number) => number
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      energyUnit: 'kcal',
      weightUnit: 'kg',
      heightUnit: 'cm',
      waterUnit: 'ml',

      setEnergyUnit: (unit) => set({ energyUnit: unit }),
      setWeightUnit: (unit) => set({ weightUnit: unit }),
      setHeightUnit: (unit) => set({ heightUnit: unit }),
      setWaterUnit: (unit) => set({ waterUnit: unit }),

      formatEnergy: (kcal) => {
        const { energyUnit } = get()
        if (energyUnit === 'kJ') {
          return `${Math.round(kcal * KCAL_TO_KJ)} kJ`
        }
        return `${Math.round(kcal)} kcal`
      },

      formatWeight: (kg) => {
        const { weightUnit } = get()
        if (weightUnit === 'lbs') {
          return `${Math.round(kg * KG_TO_LBS * 10) / 10} lbs`
        }
        return `${Math.round(kg * 10) / 10} kg`
      },

      formatHeight: (cm) => {
        const { heightUnit } = get()
        if (heightUnit === 'inches') {
          const totalInches = cm * CM_TO_INCHES
          const feet = Math.floor(totalInches / 12)
          const inches = Math.round(totalInches % 12)
          return `${feet}'${inches}"`
        }
        return `${Math.round(cm)} cm`
      },

      formatWater: (ml) => {
        const { waterUnit } = get()
        if (waterUnit === 'oz') {
          return `${Math.round(ml * ML_TO_OZ)} oz`
        }
        return `${Math.round(ml)} ml`
      },

      convertToKcal: (value) => {
        const { energyUnit } = get()
        if (energyUnit === 'kJ') {
          return value / KCAL_TO_KJ
        }
        return value
      },

      convertToKg: (value) => {
        const { weightUnit } = get()
        if (weightUnit === 'lbs') {
          return value / KG_TO_LBS
        }
        return value
      },
    }),
    {
      name: 'presence-preferences',
      partialize: (state) => ({
        energyUnit: state.energyUnit,
        weightUnit: state.weightUnit,
        heightUnit: state.heightUnit,
        waterUnit: state.waterUnit,
      }),
    }
  )
)
