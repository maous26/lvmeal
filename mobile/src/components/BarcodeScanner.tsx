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
import { lookupBarcode } from '../services/food-search'
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

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const food = await lookupBarcode(barcode)

      if (food) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onFoodFound(food)
        onClose()
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        Alert.alert(
          'Produit non trouve',
          `Le code-barres ${barcode} n'a pas ete trouve dans la base Open Food Facts.`,
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
    } catch (error) {
      console.error('Barcode lookup error:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
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
