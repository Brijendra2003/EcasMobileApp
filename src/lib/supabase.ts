// Supabase client (§5.2): session in encrypted MMKV, refresh only while the
// app is in the foreground.
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { config } from './config';
import { supabaseAuthStorage } from './storage';

export const supabase = createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    storage: supabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
