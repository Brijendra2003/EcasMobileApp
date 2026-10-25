declare module 'react-native-config' {
  export interface NativeConfig {
    APP_ENV?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    CLOUDINARY_CLOUD_NAME?: string;
  }
  export const Config: NativeConfig;
  export default Config;
}
