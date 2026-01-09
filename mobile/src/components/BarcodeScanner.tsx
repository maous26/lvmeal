import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native'
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'
import { X, Flashlight, FlashlightOff, ScanLine } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { colors, spacing, typography, radius } from '../constants/theme'
import { lookupBarcode, type BarcodeResult } from '../services/food-search'
import { analytics } from '../services/analytics-service'
import { errorReporting } from '../services/error-reporting-service'
import AddProductModal from './AddProductModal'
import type { FoodItem } from '../types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7

interface BarcodeScannerProps {
  visible: boolean
  onClose: () => void
  onFoodFound: (food: FoodItem) => void
}

export default function BarcodeScanner({
  visible,
  onClose,
  onFoodFound,
}: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [isScanning, setIsScanning] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null)

  // Request permission when modal opens
  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission()
    }
    // Reset state when modal opens
    if (visible) {
      setIsScanning(true)
      setLastScannedCode(null)
      setIsLookingUp(false)
    }
  }, [visible])

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    // Prevent multiple scans
    if (!isScanning || isLookingUp) return

    const { data: barcode } = result

    // Prevent rescanning same code immediately
    if (barcode === lastScannedCode) return

    setLastScannedCode(barcode)
    setIsScanning(false)
    setIsLookingUp(true)
    const startTime = Date.now()

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Track barcode scan started
    analytics.track('barcode_scan_started')

    try {
      const result = await lookupBarcode(barcode)
      const durationMs = Date.now() - startTime

      if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        analytics.trackAIFeature('barcode_scan', true, durationMs)

        // Check if conversion is available (dry food like lentils, rice, pasta)
        if (result.conversionAvailable && result.convertedFood) {
          // Ask user if they cooked this food
          const originalCal = result.food.nutrition.calories
          const cookedCal = result.convertedFood.nutrition.calories

          Alert.alert(
            'Aliment sec detecte',
            `Ce produit semble etre un feculent ou une legumineuse seche.\n\nValeur seche: ${originalCal} kcal/100g\nValeur cuite: ${cookedCal} kcal/100g\n\nComment vas-tu le consommer ?`,
            [
              {
                text: `Cuit (${cookedCal} kcal)`,
                onPress: () => {
                  onFoodFound(result.convertedFood!)
                  onClose()
                },
              },
              {
                text: `Sec (${originalCal} kcal)`,
                onPress: () => {
                  onFoodFound(result.food)
                  onClose()
                },
                style: 'cancel',
              },
            ]
          )
        } else {
          onFoodFound(result.food)
          onClose()
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        analytics.trackAIFeature('barcode_scan', false, durationMs, {
          error_type: 'product_not_found',
        })
        Alert.alert(
          'Produit non trouve',
          `Le code-barres ${barcode} n'a pas ete trouve dans la base Open Food Facts.\n\nTu peux l'ajouter manuellement pour l'utiliser a l'avenir.`,
          [
            {
              text: 'Ajouter',
              onPress: () => {
                setPendingBarcode(barcode)
                setShowAddModal(true)
              },
            },
            {
              text: 'Reessayer',
              onPress: () => {
                setIsScanning(true)
                setIsLookingUp(false)
                setLastScannedCode(null)
              },
            },
            {
              text: 'Fermer',
              onPress: onClose,
              style: 'cancel',
            },
          ]
        )
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      console.error('Barcode lookup error:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      errorReporting.captureFeatureError('barcode_scan', error)
      analytics.trackAIFeature('barcode_scan', false, durationMs, {
        error_type: 'exception',
      })
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la recherche du produit.',
        [
          {
            text: 'Reessayer',
            onPress: () => {
              setIsScanning(true)
              setIsLookingUp(false)
              setLastScannedCode(null)
            },
          },
          {
            text: 'Fermer',
            onPress: onClose,
            style: 'cancel',
          },
        ]
      )
    }
  }

  const toggleTorch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setTorchEnabled(!torchEnabled)
  }

  if (!visible) return null

  // Permission not yet determined
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Chargement de la camera...</Text>
        </View>
      </Modal>
    )
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.centeredContainer}>
          <Text style={styles.permissionTitle}>Acces camera requis</Text>
          <Text style={styles.permissionText}>
            Pour scanner les codes-barres, veuillez autoriser l'acces a la camera.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Autoriser la camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          enableTorch={torchEnabled}
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13',
              'ean8',
              'upc_a',
              'upc_e',
              'code128',
              'code39',
              'code93',
            ],
          }}
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scanner</Text>
            <TouchableOpacity style={styles.headerButton} onPress={toggleTorch}>
              {torchEnabled ? (
                <FlashlightOff size={24} color="#FFFFFF" />
              ) : (
                <Flashlight size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Scan Area */}
          <View style={styles.scanAreaContainer}>
            <View style={styles.scanArea}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />

              {/* Scanning line animation would go here */}
              {isScanning && (
                <View style={styles.scanLine}>
                  <ScanLine size={SCAN_AREA_SIZE - 40} color={colors.accent.primary} />
                </View>
              )}
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            {isLookingUp ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.instructionText}>Recherche du produit...</Text>
              </>
            ) : (
              <>
                <Text style={styles.instructionText}>
                  Placez le code-barres dans le cadre
                </Text>
                <Text style={styles.instructionSubtext}>
                  Compatible EAN-13, UPC-A, Code 128
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Modal d'ajout de produit */}
      <AddProductModal
        visible={showAddModal}
        barcode={pendingBarcode || ''}
        onClose={() => {
          setShowAddModal(false)
          setPendingBarcode(null)
          setIsScanning(true)
          setIsLookingUp(false)
          setLastScannedCode(null)
        }}
        onProductAdded={(food) => {
          setShowAddModal(false)
          setPendingBarcode(null)
          analytics.track('feature_used', { feature: 'local_product_added', barcode: pendingBarcode || undefined })
          onFoodFound(food)
          onClose()
        }}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  permissionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  permissionButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  closeButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  closeButtonText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.default,
    paddingBottom: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h4,
    color: '#FFFFFF',
  },
  scanAreaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE * 0.6,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.accent.primary,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.md,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: radius.md,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.md,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: radius.md,
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    alignItems: 'center',
    transform: [{ translateY: -12 }],
  },
  instructions: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.default,
    alignItems: 'center',
    gap: spacing.xs,
  },
  instructionText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  instructionSubtext: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
})
