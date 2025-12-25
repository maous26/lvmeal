import XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Read the Excel file
console.log('Reading CIQUAL Excel file...')
const workbook = XLSX.readFile(join(rootDir, 'data/ciqual_2020.xlsx'))

// Get the first sheet
const sheetName = workbook.SheetNames[0]
console.log(`Sheet name: ${sheetName}`)

const worksheet = workbook.Sheets[sheetName]

// Convert to JSON
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

// First few rows are headers
console.log('Headers (first 3 rows):')
console.log(rawData[0])
console.log(rawData[1])
console.log(rawData[2])

// Identify columns - CIQUAL structure:
// alim_code, alim_nom_fr, alim_grp_code, alim_grp_nom_fr, alim_ssgrp_code, alim_ssgrp_nom_fr,
// alim_ssssgrp_code, alim_ssssgrp_nom_fr, ...nutrient columns

const headers = rawData[0]
console.log('\nAll column headers:')
headers.forEach((h, i) => console.log(`  ${i}: ${h}`))

// Find key columns - indices based on actual file structure
const codeIdx = 6 // alim_code
const nameIdx = 7 // alim_nom_fr
const groupCodeIdx = 0 // alim_grp_code
const groupNameIdx = 3 // alim_grp_nom_fr
const subGroupCodeIdx = 1 // alim_ssgrp_code
const subGroupNameIdx = 4 // alim_ssgrp_nom_fr

// Find nutrition columns by position (from analysis above)
const energyKcalIdx = 10 // Energie, Règlement UE N° 1169/2011 (kcal/100 g)
const energyKjIdx = 9 // Energie, Règlement UE N° 1169/2011 (kJ/100 g)
const proteinsIdx = 14 // Protéines, N x facteur de Jones (g/100 g)
const carbsIdx = 16 // Glucides (g/100 g)
const fatsIdx = 17 // Lipides (g/100 g)
const fiberIdx = 26 // Fibres alimentaires (g/100 g)
const sugarIdx = 18 // Sucres (g/100 g)
const saltIdx = 49 // Sel chlorure de sodium (g/100 g)
const satFatIdx = 31 // AG saturés (g/100 g)
const sodiumIdx = 60 // Sodium (mg/100 g)

console.log('\nColumn indices:')
console.log(`  Code: ${codeIdx}`)
console.log(`  Name: ${nameIdx}`)
console.log(`  Group: ${groupNameIdx}`)
console.log(`  Energy (kcal): ${energyKcalIdx}`)
console.log(`  Energy (kJ): ${energyKjIdx}`)
console.log(`  Proteins: ${proteinsIdx}`)
console.log(`  Carbs: ${carbsIdx}`)
console.log(`  Fats: ${fatsIdx}`)
console.log(`  Fiber: ${fiberIdx}`)
console.log(`  Sugar: ${sugarIdx}`)
console.log(`  Salt: ${saltIdx}`)
console.log(`  Saturated Fat: ${satFatIdx}`)

// Parse numeric value - CIQUAL uses '-' for missing, '<' for traces
function parseNutrient(value) {
  if (value === undefined || value === null || value === '' || value === '-') {
    return null
  }
  if (typeof value === 'number') {
    return Math.round(value * 100) / 100
  }
  const str = String(value).trim()
  if (str === '-' || str === 'traces') {
    return 0
  }
  if (str.startsWith('<')) {
    // Less than value, use half of it
    const num = parseFloat(str.substring(1).replace(',', '.'))
    return isNaN(num) ? 0 : Math.round(num * 50) / 100
  }
  const num = parseFloat(str.replace(',', '.'))
  return isNaN(num) ? null : Math.round(num * 100) / 100
}

// Convert all data rows (skip header)
const foods = []
for (let i = 1; i < rawData.length; i++) {
  const row = rawData[i]
  if (!row[nameIdx]) continue // Skip empty rows

  const code = String(row[codeIdx] || '')
  const name = String(row[nameIdx] || '').trim()

  // Skip header row that might have been duplicated
  if (name === 'alim_nom_fr') continue

  // Parse macros first
  const proteins = parseNutrient(row[proteinsIdx]) || 0
  const carbs = parseNutrient(row[carbsIdx]) || 0
  const fats = parseNutrient(row[fatsIdx]) || 0

  // Parse calories - prefer kcal, fallback to kJ conversion, then calculate from macros
  let calories = parseNutrient(row[energyKcalIdx])
  if (calories === null || calories === 0) {
    const kj = parseNutrient(row[energyKjIdx])
    if (kj !== null && kj > 0) {
      calories = Math.round(kj / 4.184)
    }
  }
  // If still no calories, calculate from macros (4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat)
  if (calories === null || calories === 0) {
    calories = Math.round(proteins * 4 + carbs * 4 + fats * 9)
  }

  const food = {
    id: `ciqual-${code}`,
    code,
    name,
    groupCode: String(row[groupCodeIdx] || ''),
    groupName: String(row[groupNameIdx] || '').trim(),
    subGroupCode: String(row[subGroupCodeIdx] || ''),
    subGroupName: String(row[subGroupNameIdx] || '').trim(),
    nutrition: {
      calories,
      proteins,
      carbs,
      fats,
      fiber: parseNutrient(row[fiberIdx]),
      sugar: parseNutrient(row[sugarIdx]),
      sodium: parseNutrient(row[sodiumIdx]), // Sodium direct in mg
      saturatedFat: parseNutrient(row[satFatIdx]),
    },
    serving: 100,
    servingUnit: 'g',
    source: 'ciqual',
  }

  // Only add if we have valid nutrition data (at least some macros)
  if (food.nutrition.calories > 0 || food.nutrition.proteins > 0 || food.nutrition.carbs > 0 || food.nutrition.fats > 0) {
    foods.push(food)
  }
}

console.log(`\nProcessed ${foods.length} foods`)

// Sample output
console.log('\nSample foods:')
foods.slice(0, 5).forEach(f => {
  console.log(`  - ${f.name}: ${f.nutrition.calories} kcal, ${f.nutrition.proteins}g proteins`)
})

// Create output directory
mkdirSync(join(rootDir, 'src/data'), { recursive: true })

// Write JSON file
const outputPath = join(rootDir, 'src/data/ciqual.json')
writeFileSync(outputPath, JSON.stringify(foods, null, 2))
console.log(`\nWritten to ${outputPath}`)

// Also create a smaller search index (just id, name, groupName for quick search)
const searchIndex = foods.map(f => ({
  id: f.id,
  name: f.name.toLowerCase(),
  groupName: f.groupName.toLowerCase(),
  originalName: f.name,
}))

const searchIndexPath = join(rootDir, 'src/data/ciqual-search-index.json')
writeFileSync(searchIndexPath, JSON.stringify(searchIndex))
console.log(`Written search index to ${searchIndexPath}`)

// Create groups summary
const groups = {}
foods.forEach(f => {
  if (!groups[f.groupCode]) {
    groups[f.groupCode] = {
      code: f.groupCode,
      name: f.groupName,
      count: 0,
    }
  }
  groups[f.groupCode].count++
})

console.log('\nFood groups:')
Object.values(groups).forEach(g => {
  console.log(`  ${g.code}: ${g.name} (${g.count} items)`)
})
