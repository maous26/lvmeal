import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Search, Clock, Users, Star, Heart, Filter } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Badge, Button } from '../components/ui'
import { colors, spacing, typography, radius, shadows } from '../constants/theme'
import api from '../lib/api'
import type { Recipe } from '../types'

const categories = [
  { id: 'all', label: 'Tous', emoji: '🍽️' },
  { id: 'quick', label: 'Rapide', emoji: '⚡' },
  { id: 'healthy', label: 'Healthy', emoji: '🥗' },
  { id: 'protein', label: 'Protéiné', emoji: '💪' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
]

// Mock recipes for demo
const mockRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Buddha Bowl Quinoa',
    description: 'Un bol équilibré et coloré avec des saveurs méditerranéennes.',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
    servings: 2,
    prepTime: 15,
    cookTime: 20,
    totalTime: 35,
    difficulty: 'easy',
    ingredients: [],
    instructions: [],
    nutritionPerServing: { calories: 450, proteins: 18, carbs: 48, fats: 22 },
    tags: ['healthy', 'végétarien'],
    dietTypes: ['vegetarian'],
    allergens: ['gluten'],
    rating: 4.8,
    ratingCount: 124,
    isFavorite: true,
  },
  {
    id: '2',
    title: 'Poulet Grillé aux Herbes',
    description: 'Un classique parfaitement assaisonné.',
    imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400',
    servings: 4,
    prepTime: 10,
    cookTime: 25,
    totalTime: 35,
    difficulty: 'easy',
    ingredients: [],
    instructions: [],
    nutritionPerServing: { calories: 320, proteins: 42, carbs: 5, fats: 14 },
    tags: ['protéiné', 'low-carb'],
    dietTypes: [],
    allergens: [],
    rating: 4.6,
    ratingCount: 89,
    isFavorite: false,
  },
  {
    id: '3',
    title: 'Salade César Légère',
    description: 'La classique revisitée, plus légère.',
    imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400',
    servings: 2,
    prepTime: 15,
    cookTime: 0,
    totalTime: 15,
    difficulty: 'easy',
    ingredients: [],
    instructions: [],
    nutritionPerServing: { calories: 280, proteins: 22, carbs: 12, fats: 16 },
    tags: ['rapide', 'healthy'],
    dietTypes: [],
    allergens: ['lait', 'gluten'],
    rating: 4.5,
    ratingCount: 67,
    isFavorite: false,
  },
]

export default function RecipesScreen() {
  const navigation = useNavigation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [recipes, setRecipes] = useState<Recipe[]>(mockRecipes)
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length > 2) {
      setIsLoading(true)
      try {
        const result = await api.searchRecipes(query)
        if (result.recipes?.length) {
          setRecipes(result.recipes)
        }
      } catch (error) {
        console.log('Search error, using mock data')
      } finally {
        setIsLoading(false)
      }
    } else if (query.length === 0) {
      setRecipes(mockRecipes)
    }
  }

  const handleRecipePress = (recipe: Recipe) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore - Navigation typing
    navigation.navigate('RecipeDetail', { recipe })
  }

  const handleCategoryPress = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCategory(categoryId)
  }

  const difficultyLabel = {
    easy: 'Facile',
    medium: 'Moyen',
    hard: 'Difficile',
  }

  const renderRecipeCard = ({ item }: { item: Recipe }) => (
    <Card
      style={styles.recipeCard}
      onPress={() => handleRecipePress(item)}
      padding="none"
    >
      <Image
        source={{ uri: item.imageUrl || 'https://via.placeholder.com/400x200' }}
        style={styles.recipeImage}
        resizeMode="cover"
      />

      {item.isFavorite && (
        <View style={styles.favoriteIcon}>
          <Heart size={18} color={colors.error} fill={colors.error} />
        </View>
      )}

      <View style={styles.recipeContent}>
        <Text style={styles.recipeTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.recipeStats}>
          <View style={styles.recipeStat}>
            <Clock size={14} color={colors.text.tertiary} />
            <Text style={styles.recipeStatText}>{item.totalTime} min</Text>
          </View>
          <View style={styles.recipeStat}>
            <Users size={14} color={colors.text.tertiary} />
            <Text style={styles.recipeStatText}>{item.servings}</Text>
          </View>
          {item.rating && (
            <View style={styles.recipeStat}>
              <Star size={14} color={colors.warning} fill={colors.warning} />
              <Text style={styles.recipeStatText}>{item.rating}</Text>
            </View>
          )}
        </View>

        <View style={styles.recipeTags}>
          <Badge variant="secondary" size="sm">
            {difficultyLabel[item.difficulty]}
          </Badge>
          <Badge size="sm">
            {item.nutritionPerServing.calories} kcal
          </Badge>
        </View>
      </View>
    </Card>
  )

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recettes</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Search size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchText}
            placeholder="Rechercher une recette..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={20} color={colors.accent.primary} />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              selectedCategory === category.id && styles.categoryChipActive,
            ]}
            onPress={() => handleCategoryPress(category.id)}
          >
            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === category.id && styles.categoryLabelActive,
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recipes List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
      ) : (
        <FlatList
          data={recipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.recipesList}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.recipesRow}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    padding: spacing.default,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.sm,
  },
  searchText: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.accent.light,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesScroll: {
    maxHeight: 50,
    marginBottom: spacing.md,
  },
  categoriesContent: {
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  categoryLabelActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipesList: {
    paddingHorizontal: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  recipesRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  recipeCard: {
    width: '48%',
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.bg.tertiary,
  },
  favoriteIcon: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  recipeContent: {
    padding: spacing.md,
  },
  recipeTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  recipeStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  recipeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recipeStatText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  recipeTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
})
