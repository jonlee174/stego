import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jonlee.stego',
  appName: 'Stego',
  webDir: 'dist',
  ios: {
    // Let the web view run edge to edge; the CSS handles the safe areas through
    // env(safe-area-inset-*), so the page background follows the active theme
    // right up under the status bar instead of showing a fixed native colour.
    contentInset: 'never',
  },
  server: {
    // `npx cap run ios --livereload` fills this in; unused for normal builds.
    androidScheme: 'https',
  },
};

export default config;
