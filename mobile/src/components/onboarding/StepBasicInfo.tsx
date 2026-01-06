import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { spacing } from '../../constants/theme'
import type { Gender, UserProfile } from '../../types'

interface StepBasicInfoProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const genderOptions = [
  { value: 'male' as Gender, label: 'Homme', icon: '👨' },
  { value: 'female' as Gender, label: 'Femme', icon: '👩' },
  { value: 'other' as Gender, label: 'Autre', icon: '🧑' },
]

export function StepBasicInfo({ data, onChange }: StepBasicInfoProps) {
  return (
    <View style={styles.container}>
      <Input
        label="Prénom"
        placeholder="Ton prénom"
        value={data.firstName || ''}
        onChangeText={(text) => onChange({ ...data, firstName: text })}
        autoCapitalize="words"
        containerStyle={styles.input}
      />

      <Select
        label="Genre"
        placeholder="Sélectionne ton genre"
        value={data.gender}
        options={genderOptions}
        onChange={(value) => onChange({ ...data, gender: value })}
        containerStyle={styles.input}
      />

      <Input
        label="Âge"
        placeholder="Ex: 35"
        value={data.age?.toString() || ''}
        onChangeText={(text) => onChange({ ...data, age: parseInt(text) || undefined })}
        keyboardType="number-pad"
        hint="Utilisé pour calculer tes besoins caloriques"
        containerStyle={styles.input}
      />

      <Input
        label="Taille (cm)"
        placeholder="Ex: 175"
        value={data.height?.toString() || ''}
        onChangeText={(text) => onChange({ ...data, height: parseInt(text) || undefined })}
        keyboardType="number-pad"
        containerStyle={styles.input}
      />

      <Input
        label="Poids actuel (kg)"
        placeholder="Ex: 70"
        value={data.weight?.toString() || ''}
        onChangeText={(text) => onChange({ ...data, weight: parseFloat(text) || undefined })}
        keyboardType="decimal-pad"
        containerStyle={styles.input}
      />

      <Input
        label="Poids objectif (kg)"
        placeholder="Ex: 65"
        value={data.targetWeight?.toString() || ''}
        onChangeText={(text) => onChange({ ...data, targetWeight: parseFloat(text) || undefined })}
        keyboardType="decimal-pad"
        hint="Laisse vide si tu souhaites maintenir ton poids"
        containerStyle={styles.input}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  input: {
    marginBottom: 0,
  },
})

export default StepBasicInfo
