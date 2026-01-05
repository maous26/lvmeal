/**
 * Expo Config Plugin for Health Connect
 *
 * Adds required permissions and intent filters for Health Connect on Android
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const HEALTH_PERMISSIONS = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_BODY_FAT',
];

function withHealthConnect(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // Add Health Connect permissions
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    for (const permission of HEALTH_PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === permission
      );
      if (!exists) {
        manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    }

    // Add intent filter for Health Connect permissions rationale
    const application = manifest.application?.[0];
    if (application?.activity?.[0]) {
      const activity = application.activity[0];

      if (!activity['intent-filter']) {
        activity['intent-filter'] = [];
      }

      // Check if intent filter already exists
      const hasHealthConnectIntent = activity['intent-filter'].some((filter) =>
        filter.action?.some(
          (action) =>
            action.$?.['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'
        )
      );

      if (!hasHealthConnectIntent) {
        activity['intent-filter'].push({
          action: [
            {
              $: {
                'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
              },
            },
          ],
        });
      }
    }

    // Add queries for Health Connect package
    if (!manifest.queries) {
      manifest.queries = [];
    }

    const hasHealthConnectQuery = manifest.queries.some((query) =>
      query.package?.some(
        (pkg) => pkg.$?.['android:name'] === 'com.google.android.apps.healthdata'
      )
    );

    if (!hasHealthConnectQuery) {
      manifest.queries.push({
        package: [
          {
            $: { 'android:name': 'com.google.android.apps.healthdata' },
          },
        ],
        intent: [
          {
            action: [
              {
                $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = withHealthConnect;
