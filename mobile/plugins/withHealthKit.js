/**
 * Expo Config Plugin for Apple HealthKit
 *
 * Ensures HealthKit entitlements and Info.plist entries are properly configured
 * for production builds via EAS Build.
 */

const {
  withEntitlementsPlist,
  withInfoPlist,
} = require('@expo/config-plugins');

/**
 * Add HealthKit entitlements
 */
function withHealthKitEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    // Enable HealthKit capability
    config.modResults['com.apple.developer.healthkit'] = true;

    // Empty array for specific health data types (required)
    config.modResults['com.apple.developer.healthkit.access'] = [];

    // Enable background delivery for health updates
    config.modResults['com.apple.developer.healthkit.background-delivery'] = true;

    return config;
  });
}

/**
 * Add HealthKit usage descriptions to Info.plist
 */
function withHealthKitInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    // Required: Why the app needs to read health data
    config.modResults.NSHealthShareUsageDescription =
      config.modResults.NSHealthShareUsageDescription ||
      "Presence accède à vos données de santé (pas, sommeil, poids) pour personnaliser vos recommandations nutritionnelles.";

    // Required: Why the app needs to write health data
    config.modResults.NSHealthUpdateUsageDescription =
      config.modResults.NSHealthUpdateUsageDescription ||
      "Presence peut enregistrer vos données nutritionnelles dans Apple Santé.";

    // Add HealthKit to UIRequiredDeviceCapabilities for App Store filtering
    // Note: This is optional - only add if you want to restrict to HealthKit-capable devices
    // const capabilities = config.modResults.UIRequiredDeviceCapabilities || [];
    // if (!capabilities.includes('healthkit')) {
    //   capabilities.push('healthkit');
    //   config.modResults.UIRequiredDeviceCapabilities = capabilities;
    // }

    return config;
  });
}

/**
 * Main plugin - combines entitlements and Info.plist modifications
 */
function withHealthKit(config) {
  config = withHealthKitEntitlements(config);
  config = withHealthKitInfoPlist(config);
  return config;
}

module.exports = withHealthKit;
