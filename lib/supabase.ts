import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL = 'https://bftsfgoenlgflhpfrqgf.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdHNmZ29lbmxnZmxocGZycWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MTM5NzQsImV4cCI6MjEwMDE4OTk3NH0.2LSDT2ZD_yFtjTWINJa72KKiZSH0fw-hERTUX08YeQ4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
