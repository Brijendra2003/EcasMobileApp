// Typed wrapper over react-native-config (one .env per flavour, public values only).
import Config from 'react-native-config';

export type AppEnv = 'development' | 'staging' | 'production';

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name} in the .env file for this build flavour`);
  }
  return value;
}

export const config = {
  appEnv: (Config.APP_ENV ?? 'development') as AppEnv,
  supabaseUrl: required('SUPABASE_URL', Config.SUPABASE_URL),
  supabasePublishableKey: required('SUPABASE_PUBLISHABLE_KEY', Config.SUPABASE_PUBLISHABLE_KEY),
  cloudinaryCloudName: Config.CLOUDINARY_CLOUD_NAME ?? '',
  /** Custom URL scheme for deep links (§12). */
  scheme: 'collegeapp',
} as const;
