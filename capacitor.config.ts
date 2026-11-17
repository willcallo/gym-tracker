import type { CapacitorConfig } from '@capacitor/cli';

// The iOS app is a native shell around the website: it loads the pages from the server below,
// so a Vercel deploy updates the app without a new build. Native features (Live Activities,
// notifications) are added on top.
//
// For local development, point it at your dev server before syncing:
//   CAP_SERVER_URL=http://localhost:3000 npx cap sync ios
const serverUrl = process.env.CAP_SERVER_URL ?? 'https://gym-tracker-gamma-sable.vercel.app';

const config: CapacitorConfig = {
  // Permanent once the app is on TestFlight or the App Store. Change it before then if you want.
  appId: 'com.willcallo.gymtracker',
  appName: 'Gym Tracker',
  // Required by Capacitor; only holds a fallback page (see ios-shell/index.html).
  webDir: 'ios-shell',
  server: {
    url: serverUrl,
    // Plain http is only ever allowed for a local dev server.
    cleartext: serverUrl.startsWith('http://'),
  },
  ios: {
    // The site already handles the notch and home indicator with safe-area insets.
    contentInset: 'never',
  },
};

export default config;
