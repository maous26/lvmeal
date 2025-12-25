'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { User, Ruler, Scale, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Gender, UserProfile } from '@/types'

interface StepBasicInfoProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
  className?: string
}

const genderOptions: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
  { value: 'other', label: 'Autre' },
]

export function StepBasicInfo({ data, onChange, className }: StepBasicInfoProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Name */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Input
          label="Prénom"
          placeholder="Votre prénom"
          value={data.firstName || ''}
          onChange={(e) => onChange({ ...data, firstName: e.target.value })}
          leftIcon={User}
        />
      </motion.div>

      {/* Gender */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Select
          value={data.gender}
          onValueChange={(value: Gender) => onChange({ ...data, gender: value })}
        >
          <SelectTrigger label="Genre">
            <SelectValue placeholder="Sélectionnez votre genre" />
          </SelectTrigger>
          <SelectContent>
            {genderOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Age */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Input
          label="Âge"
          type="number"
          placeholder="Ex: 35"
          value={data.age || ''}
          onChange={(e) => onChange({ ...data, age: parseInt(e.target.value) || undefined })}
          hint="Utilisé pour calculer vos besoins caloriques"
        />
      </motion.div>

      {/* Height */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Input
          label="Taille (cm)"
          type="number"
          placeholder="Ex: 175"
          value={data.height || ''}
          onChange={(e) => onChange({ ...data, height: parseInt(e.target.value) || undefined })}
          leftIcon={Ruler}
        />
      </motion.div>

      {/* Current Weight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Input
          label="Poids actuel (kg)"
          type="number"
          placeholder="Ex: 70"
          value={data.weight || ''}
          onChange={(e) => onChange({ ...data, weight: parseFloat(e.target.value) || undefined })}
          leftIcon={Scale}
        />
      </motion.div>

      {/* Target Weight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Input
          label="Poids objectif (kg)"
          type="number"
          placeholder="Ex: 65"
          value={data.targetWeight || ''}
          onChange={(e) => onChange({ ...data, targetWeight: parseFloat(e.target.value) || undefined })}
          leftIcon={Target}
          hint="Laissez vide si vous souhaitez maintenir votre poids"
        />
      </motion.div>
    </div>
  )
}
